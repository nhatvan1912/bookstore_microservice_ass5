from rest_framework import generics
from .models import Staff
from .serializers import StaffSerializer

class StaffListCreate(generics.ListCreateAPIView):
    queryset = Staff.objects.all()
    serializer_class = StaffSerializer
