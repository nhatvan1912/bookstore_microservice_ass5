from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Order, OrderItem
from .serializers import OrderSerializer
import requests

CART_SERVICE_URL = "http://cart-service:8000"
PAY_SERVICE_URL = "http://pay-service:8000"
SHIP_SERVICE_URL = "http://ship-service:8000"
BOOK_SERVICE_URL = "http://book-service:8000"

class OrderCreate(APIView):
    def post(self, request):
        customer_id = request.data.get("customer_id")
        pay_method = request.data.get("pay_method", "Credit Card")
        ship_method = request.data.get("ship_method", "Standard")
        
        # Get cart
        try:
            r = requests.get(f"{CART_SERVICE_URL}/carts/customer/{customer_id}/")
            if r.status_code != 200:
                return Response({"error": "Cart not found or empty"}, status=400)
            cart_data = r.json()
        except:
            return Response({"error": "Cannot access cart-service"}, status=500)
            
        items = cart_data.get('items', [])
        if not items:
            return Response({"error": "Cart is empty"}, status=400)
            
        # Create order
        order = Order.objects.create(
            customer_id=customer_id, 
            pay_method=pay_method, 
            ship_method=ship_method
        )
        total = 0
        for item in items:
            book_id = item['book_id']
            qty = item['quantity']
            # Get book price
            try:
                b_res = requests.get(f"{BOOK_SERVICE_URL}/books/{book_id}/")
                price = float(b_res.json().get('price', 0))
            except:
                price = 0
            
            OrderItem.objects.create(order=order, book_id=book_id, quantity=qty, price=price)
            total += price * qty
            
        order.total_amount = total
        order.save()
        
        # Trigger payment
        try:
            requests.post(f"{PAY_SERVICE_URL}/payments/", json={
                "order_id": order.id,
                "amount": float(total),
                "method": pay_method
            })
        except:
            pass
            
        # Trigger shipping
        try:
            requests.post(f"{SHIP_SERVICE_URL}/shipments/", json={
                "order_id": order.id,
                "address": request.data.get("address", "Default Address"),
                "method": ship_method
            })
        except:
            pass
            
        return Response(OrderSerializer(order).data)
