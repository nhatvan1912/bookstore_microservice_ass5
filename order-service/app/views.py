from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Order, OrderItem
from .serializers import OrderSerializer
import requests
import json

CART_SERVICE_URL = "http://cart-service:8000"
PAY_SERVICE_URL = "http://pay-service:8000"
SHIP_SERVICE_URL = "http://ship-service:8000"
BOOK_SERVICE_URL = "http://book-service:8000"


def _clear_customer_cart(customer_id):
    """Best-effort cart cleanup after a successful order creation."""
    try:
        cart_resp = requests.get(f"{CART_SERVICE_URL}/carts/customer/{customer_id}/", timeout=10)
        if cart_resp.status_code != 200:
            return
        cart = cart_resp.json()
        for item in cart.get("items", []):
            item_id = item.get("id")
            if item_id is None:
                continue
            try:
                requests.delete(f"{CART_SERVICE_URL}/carts/items/{item_id}/", timeout=10)
            except Exception:
                continue
    except Exception:
        return


class OrderListCreate(APIView):
    def get(self, request):
        queryset = Order.objects.all()
        customer_id = request.query_params.get("customer_id")
        status = request.query_params.get("status")
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)
        if status:
            queryset = queryset.filter(status=status)
        return Response(OrderSerializer(queryset, many=True).data)

    def post(self, request):
        customer_id = request.data.get("customer_id")
        pay_method = request.data.get("pay_method", "Credit Card")
        payment_details = request.data.get("payment_details", {})
        ship_method = request.data.get("ship_method", "Standard")
        address = request.data.get("address", "Default Address")
        is_cod = str(pay_method).upper() == "COD"

        # Get cart
        try:
            r = requests.get(f"{CART_SERVICE_URL}/carts/customer/{customer_id}/")
            if r.status_code != 200:
                return Response({"error": "Cart not found or empty"}, status=400)
            cart_data = r.json()
        except Exception as exc:
            return Response({"error": "Cannot access cart-service", "details": str(exc)}, status=500)

        items = cart_data.get("items", [])
        if not items:
            return Response({"error": "Cart is empty"}, status=400)

        order = Order.objects.create(
            customer_id=customer_id,
            pay_method=pay_method,
            payment_details=json.dumps(payment_details, ensure_ascii=True),
            ship_method=ship_method,
            shipping_address=address,
            status="Pending",
        )
        total = 0
        for item in items:
            book_id = item.get("book_id")
            qty = item.get("quantity", 0)
            try:
                b_res = requests.get(f"{BOOK_SERVICE_URL}/books/{book_id}/")
                price = float(b_res.json().get("price", 0))
            except Exception:
                price = 0

            OrderItem.objects.create(order=order, book_id=book_id, quantity=qty, price=price)
            total += price * qty

        order.total_amount = total
        order.save()

        payment_ok = False
        shipping_ok = False

        # Step 1: Reserve payment
        if is_cod:
            payment_ok = True
        else:
            try:
                pay_resp = requests.post(f"{PAY_SERVICE_URL}/payments/", json={
                    "order_id": order.id,
                    "amount": float(total),
                    "method": pay_method,
                    "status": "Reserved",
                })
                payment_ok = pay_resp.status_code in {200, 201}
            except Exception:
                payment_ok = False

        # Step 2: Reserve shipping
        if payment_ok:
            try:
                ship_resp = requests.post(f"{SHIP_SERVICE_URL}/shipments/", json={
                    "order_id": order.id,
                    "address": address,
                    "method": ship_method,
                    "status": "Reserved",
                })
                shipping_ok = ship_resp.status_code in {200, 201}
            except Exception:
                shipping_ok = False

        # Step 3: Confirm or compensate
        if payment_ok and shipping_ok:
            order.status = "PendingApproval"
        else:
            order.status = "Failed"
            # Compensate payment when shipping reservation fails.
            if payment_ok and not shipping_ok and not is_cod:
                try:
                    requests.post(f"{PAY_SERVICE_URL}/payments/", json={
                        "order_id": order.id,
                        "amount": float(total),
                        "method": pay_method,
                        "status": "Refunded",
                    })
                except Exception:
                    pass

        order.save()
        if order.status != "Failed":
            _clear_customer_cart(customer_id)
        return Response(OrderSerializer(order).data)


class OrderDetail(APIView):
    def get(self, request, pk):
        try:
            order = Order.objects.get(pk=pk)
            return Response(OrderSerializer(order).data)
        except Order.DoesNotExist:
            return Response({"error": "Order not found"}, status=404)

    def put(self, request, pk):
        try:
            order = Order.objects.get(pk=pk)
        except Order.DoesNotExist:
            return Response({"error": "Order not found"}, status=404)

        requested_status = request.data.get("status")
        customer_id = request.data.get("customer_id")

        if requested_status == "Cancelled":
            if str(customer_id) != str(order.customer_id):
                return Response({"error": "Only order owner can cancel"}, status=403)
            if order.status not in {"Pending", "PendingApproval"}:
                return Response({"error": "Order cannot be cancelled at current status"}, status=400)

        if requested_status in {"Confirm", "Rejected"} and order.status != "PendingApproval":
            return Response({"error": "Only pending approval orders can be reviewed by staff"}, status=400)

        if requested_status == "Rejected":
            rejection_reason = str(request.data.get("rejection_reason", "")).strip()
            if not rejection_reason:
                return Response({"error": "rejection_reason is required for rejected orders"}, status=400)

        update_payload = dict(request.data)
        if requested_status == "Confirm":
            update_payload["rejection_reason"] = ""

        serializer = OrderSerializer(order, data=update_payload, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=400)

    def delete(self, request, pk):
        try:
            order = Order.objects.get(pk=pk)
        except Order.DoesNotExist:
            return Response({"error": "Order not found"}, status=404)
        order.delete()
        return Response({"status": "deleted"})
