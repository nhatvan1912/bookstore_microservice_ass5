from django.shortcuts import render
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
import requests
import json

SERVICES = {
    'book': 'http://book-service:8000',
    'cart': 'http://cart-service:8000',
    'customer': 'http://customer-service:8000',
    'order': 'http://order-service:8000',
    'staff': 'http://staff-service:8000',
    'catalog': 'http://catalog-service:8000',
    'pay': 'http://pay-service:8000',
    'ship': 'http://ship-service:8000',
    'rate': 'http://comment-rate-service:8000',
    'ai': 'http://recommender-ai-service:8000',
}

def index(request):
    return render(request, "index.html")

@csrf_exempt
def proxy_api(request, service_name, path):
    if service_name not in SERVICES:
        return JsonResponse({"error": "Service not found"}, status=404)
        
    url = f"{SERVICES[service_name]}/{path}"
    
    # Forward the request
    method = request.method
    headers = {'Content-Type': 'application/json'}
    data = request.body
    
    try:
        if method == 'GET':
            resp = requests.get(url, params=request.GET)
        elif method == 'POST':
            resp = requests.post(url, data=data, headers=headers)
        elif method == 'PUT':
            resp = requests.put(url, data=data, headers=headers)
        elif method == 'DELETE':
            resp = requests.delete(url)
        else:
            return JsonResponse({"error": "Method not allowed"}, status=405)
            
        return HttpResponse(resp.content, status=resp.status_code, content_type=resp.headers.get('Content-Type', 'application/json'))
    except Exception as e:
        return JsonResponse({"error": "Gateway timeout or connection error", "details": str(e)}, status=504)
