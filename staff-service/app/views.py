from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.contrib.auth.hashers import make_password, check_password
from .models import Staff
from .serializers import StaffSerializer


class StaffListCreate(generics.ListCreateAPIView):
    queryset = Staff.objects.all()
    serializer_class = StaffSerializer

    def perform_create(self, serializer):
        password = serializer.validated_data.get("password")
        if not password:
            raise ValidationError({"password": "Password is required"})
        serializer.save(password=make_password(password))


class StaffDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = Staff.objects.all()
    serializer_class = StaffSerializer

    def perform_update(self, serializer):
        password = serializer.validated_data.get("password")
        if password:
            serializer.save(password=make_password(password))
        else:
            serializer.save()


class StaffLogin(APIView):
    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")
        try:
            staff = Staff.objects.get(email=email)
        except Staff.DoesNotExist:
            return Response({"error": "Staff not found"}, status=404)

        if not password or not check_password(password, staff.password):
            return Response({"error": "Invalid credentials"}, status=401)

        return Response(StaffSerializer(staff).data)
