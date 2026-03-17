from rest_framework import generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.exceptions import ValidationError
from django.contrib.auth.hashers import make_password, check_password
from .models import Manager
from .serializers import ManagerSerializer


class ManagerListCreate(generics.ListCreateAPIView):
    queryset = Manager.objects.all()
    serializer_class = ManagerSerializer

    def perform_create(self, serializer):
        password = serializer.validated_data.get("password")
        if not password:
            raise ValidationError({"password": "Password is required"})
        serializer.save(password=make_password(password))


class ManagerDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = Manager.objects.all()
    serializer_class = ManagerSerializer

    def perform_update(self, serializer):
        password = serializer.validated_data.get("password")
        if password:
            serializer.save(password=make_password(password))
        else:
            serializer.save()


class ManagerLogin(APIView):
    def post(self, request):
        email = request.data.get("email")
        password = request.data.get("password")
        try:
            manager = Manager.objects.get(email=email)
        except Manager.DoesNotExist:
            return Response({"error": "Manager not found"}, status=404)

        if not password or not check_password(password, manager.password):
            return Response({"error": "Invalid credentials"}, status=401)

        return Response(ManagerSerializer(manager).data)
