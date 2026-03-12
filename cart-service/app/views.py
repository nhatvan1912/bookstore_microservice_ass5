from rest_framework.views import APIView
from rest_framework.response import Response
from .models import Cart, CartItem
from .serializers import CartSerializer, CartItemSerializer
import requests

BOOK_SERVICE_URL = "http://book-service:8000"

class CartCreate(APIView):
    def post(self, request):
        serializer = CartSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors)

class CartItemModify(APIView):
    def post(self, request):
        book_id = request.data.get("book_id")
        quantity = request.data.get("quantity", 1)
        cart_id = request.data.get("cart")
        
        try:
            r = requests.get(f"{BOOK_SERVICE_URL}/books/{book_id}/")
            if r.status_code != 200:
                return Response({"error": "Book not found"}, status=404)
        except Exception as e:
            return Response({"error": "Cannot connect to book-service", "details": str(e)}, status=500)
            
        cart = Cart.objects.get(id=cart_id)
        item, created = CartItem.objects.get_or_create(cart=cart, book_id=book_id, defaults={'quantity': quantity})
        if not created:
            item.quantity += int(quantity)
            item.save()
        
        serializer = CartItemSerializer(item)
        return Response(serializer.data)
        
    def put(self, request, pk):
        try:
            item = CartItem.objects.get(pk=pk)
            item.quantity = request.data.get("quantity", item.quantity)
            item.save()
            return Response(CartItemSerializer(item).data)
        except CartItem.DoesNotExist:
            return Response({"error": "Not found"}, status=404)
            
    def delete(self, request, pk):
        try:
            item = CartItem.objects.get(pk=pk)
            item.delete()
            return Response({"status": "deleted"})
        except CartItem.DoesNotExist:
            return Response({"error": "Not found"}, status=404)

class ViewCart(APIView):
    def get(self, request, customer_id):
        try:
            cart = Cart.objects.get(customer_id=customer_id)
            serializer = CartSerializer(cart)
            return Response(serializer.data)
        except Cart.DoesNotExist:
            return Response({"error": "Cart not found"}, status=404)
