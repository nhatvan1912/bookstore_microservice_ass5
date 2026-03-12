from rest_framework import generics
from .models import Manager
from .serializers import ManagerSerializer

class ManagerListCreate(generics.ListCreateAPIView):
    queryset = Manager.objects.all()
    serializer_class = ManagerSerializer
