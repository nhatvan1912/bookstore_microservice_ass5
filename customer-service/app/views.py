from rest_framework.views import APIView
from rest_framework.response import Response
from django.contrib.auth.hashers import make_password, check_password
from .models import Customer
from .serializers import CustomerSerializer
import requests

CART_SERVICE_URL = "http://cart-service:8000"

class CustomerListCreate(APIView):
    def get(self, request):
        customers = Customer.objects.all()
        serializer = CustomerSerializer(customers, many=True)
        return Response(serializer.data)

    def post(self, request):
        serializer = CustomerSerializer(data=request.data)
        if serializer.is_valid():
            password = serializer.validated_data.get("password")
            if not password:
                return Response({"error": "Password is required"}, status=400)
            customer = Customer.objects.create(
                name=serializer.validated_data.get("name"),
                email=serializer.validated_data.get("email"),
                password=make_password(password),
            )
            # Call cart-service
            try:
                requests.post(
                    f"{CART_SERVICE_URL}/carts/",
                    json={"customer_id": customer.id}
                )
            except:
                pass # logging could be placed here
            return Response(CustomerSerializer(customer).data)
        return Response(serializer.errors)


class CustomerLogin(APIView):
    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")
        try:
            customer = Customer.objects.get(email=email)
            if not password or not check_password(password, customer.password):
                return Response({"error": "Invalid credentials"}, status=401)
            return Response(CustomerSerializer(customer).data)
        except Customer.DoesNotExist:
            return Response({"error": "Customer not found"}, status=404)
