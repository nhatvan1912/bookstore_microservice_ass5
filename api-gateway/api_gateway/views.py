import json
import logging
import os
from datetime import datetime, timedelta, timezone

import jwt
import requests
from django.http import HttpResponse, JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt

SERVICES = {
    'book': 'http://book-service:8000',
    'cart': 'http://cart-service:8000',
    'customer': 'http://customer-service:8000',
    'order': 'http://order-service:8000',
    'staff': 'http://staff-service:8000',
    'manager': 'http://manager-service:8000',
    'catalog': 'http://catalog-service:8000',
    'pay': 'http://pay-service:8000',
    'ship': 'http://ship-service:8000',
    'rate': 'http://comment-rate-service:8000',
    'ai': 'http://recommender-ai-service:8000',
}

AUTH_ENDPOINTS = {
    "customer": ("customer", "customers/login/"),
    "staff": ("staff", "staff/login/"),
    "manager": ("manager", "managers/login/"),
}

JWT_SECRET = os.environ.get("JWT_SECRET", "bookstore-dev-secret")
JWT_ALG = "HS256"
JWT_EXP_MINUTES = int(os.environ.get("JWT_EXP_MINUTES", "240"))

logger = logging.getLogger("api_gateway.audit")
if not logger.handlers:
    logging.basicConfig(level=logging.INFO)


def _json_body(request):
    try:
        return json.loads(request.body.decode("utf-8") or "{}")
    except Exception:
        return {}


def _issue_token(user_id, role, email):
    payload = {
        "sub": str(user_id),
        "role": role,
        "email": email,
        "iat": datetime.now(tz=timezone.utc),
        "exp": datetime.now(tz=timezone.utc) + timedelta(minutes=JWT_EXP_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def _decode_token_from_request(request):
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        return None
    token = auth.split(" ", 1)[1].strip()
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG], options={"verify_sub": False})
    except Exception:
        return None


def _is_public_endpoint(service_name, path, method):
    normalized = path.strip("/")
    if service_name == "book" and method == "GET" and normalized.startswith("books"):
        return True
    if service_name == "catalog" and method == "GET" and normalized.startswith("catalogs"):
        return True
    if service_name == "rate" and method == "GET" and normalized.startswith("reviews"):
        return True
    return False


def _is_authorized(claims, service_name, path, method, query_params):
    if _is_public_endpoint(service_name, path, method):
        return True
    if not claims:
        return False

    role = claims.get("role")
    user_id = str(claims.get("sub"))
    normalized = path.strip("/")

    if role == "manager":
        return True

    if role == "staff":
        if service_name in {"book", "catalog"}:
            return True
        if service_name in {"order", "pay", "ship", "ai"} and method in {"GET", "PUT", "PATCH"}:
            return True
        if service_name == "rate" and method in {"GET", "PUT", "PATCH"}:
            return True
        if service_name == "staff" and normalized.startswith("staff/") and method in {"GET"}:
            return True
        return False

    if role == "customer":
        if service_name in {"book", "catalog", "ai"} and method == "GET":
            return True
        if service_name == "rate" and method in {"GET", "POST"}:
            return True
        if service_name == "order":
            if method == "POST":
                return True
            if method == "GET":
                customer_id = query_params.get("customer_id")
                return customer_id == user_id
            if method in {"PUT", "PATCH"} and normalized.startswith("orders/"):
                return True
            return False
        if service_name == "cart":
            return True
        if service_name == "customer" and method == "GET":
            return True
        return False

    return False

def index(request):
    return render(request, "index.html")


def customer_page(request):
    return render(request, "customer.html")


def staff_page(request):
    return render(request, "staff.html")


def manager_page(request):
    return render(request, "manager.html")


@csrf_exempt
def auth_login(request):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    payload = _json_body(request)
    role = payload.get("role")
    email = payload.get("email")
    password = payload.get("password")

    if role not in AUTH_ENDPOINTS:
        return JsonResponse({"error": "Invalid role"}, status=400)
    if not email or not password:
        return JsonResponse({"error": "Email and password are required"}, status=400)

    target_service, target_path = AUTH_ENDPOINTS[role]
    url = f"{SERVICES[target_service]}/{target_path}"

    try:
        resp = requests.post(url, json={"email": email, "password": password}, timeout=15)
        if resp.status_code != 200:
            return HttpResponse(
                resp.content,
                status=resp.status_code,
                content_type=resp.headers.get("Content-Type", "application/json"),
            )
        user_data = resp.json()
        token = _issue_token(user_data.get("id"), role, user_data.get("email", email))
        logger.info("login role=%s user=%s", role, email)
        return JsonResponse({"token": token, "role": role, "user": user_data})
    except Exception as exc:
        return JsonResponse({"error": "Auth service unavailable", "details": str(exc)}, status=504)


@csrf_exempt
def auth_register_customer(request):
    if request.method != "POST":
        return JsonResponse({"error": "Method not allowed"}, status=405)

    payload = _json_body(request)
    required = ["name", "email", "password"]
    if any(not payload.get(key) for key in required):
        return JsonResponse({"error": "name, email, password are required"}, status=400)

    url = f"{SERVICES['customer']}/customers/"
    try:
        resp = requests.post(url, json=payload, timeout=15)
        if resp.status_code not in {200, 201}:
            return HttpResponse(
                resp.content,
                status=resp.status_code,
                content_type=resp.headers.get("Content-Type", "application/json"),
            )
        user_data = resp.json()
        token = _issue_token(user_data.get("id"), "customer", user_data.get("email"))
        logger.info("register role=customer user=%s", user_data.get("email"))
        return JsonResponse({"token": token, "role": "customer", "user": user_data}, status=201)
    except Exception as exc:
        return JsonResponse({"error": "Customer service unavailable", "details": str(exc)}, status=504)


def auth_me(request):
    claims = _decode_token_from_request(request)
    if not claims:
        return JsonResponse({"error": "Unauthorized"}, status=401)
    return JsonResponse({
        "id": claims.get("sub"),
        "email": claims.get("email"),
        "role": claims.get("role"),
    })

@csrf_exempt
def proxy_api(request, service_name, path):
    if service_name not in SERVICES:
        return JsonResponse({"error": "Service not found"}, status=404)

    claims = _decode_token_from_request(request)
    if not _is_authorized(claims, service_name, path, request.method, request.GET):
        return JsonResponse({"error": "Forbidden"}, status=403)

    url = f"{SERVICES[service_name]}/{path}"

    # Forward the request
    method = request.method
    headers = {"Content-Type": "application/json"}
    if request.headers.get("Authorization"):
        headers["Authorization"] = request.headers.get("Authorization")
    data = request.body

    try:
        logger.info(
            "gateway method=%s service=%s path=%s role=%s user=%s",
            method,
            service_name,
            path,
            (claims or {}).get("role"),
            (claims or {}).get("sub"),
        )
        if method == 'GET':
            resp = requests.get(url, params=request.GET, headers=headers, timeout=20)
        elif method == 'POST':
            resp = requests.post(url, data=data, headers=headers, timeout=20)
        elif method == 'PUT':
            resp = requests.put(url, data=data, headers=headers, timeout=20)
        elif method == 'PATCH':
            resp = requests.patch(url, data=data, headers=headers, timeout=20)
        elif method == 'DELETE':
            resp = requests.delete(url, headers=headers, timeout=20)
        else:
            return JsonResponse({"error": "Method not allowed"}, status=405)

        return HttpResponse(resp.content, status=resp.status_code, content_type=resp.headers.get('Content-Type', 'application/json'))
    except Exception as e:
        return JsonResponse({"error": "Gateway timeout or connection error", "details": str(e)}, status=504)
