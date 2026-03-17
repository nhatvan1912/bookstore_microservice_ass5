from rest_framework import generics
from .models import Catalog
from .serializers import CatalogSerializer


class CatalogListCreate(generics.ListCreateAPIView):
    queryset = Catalog.objects.all()
    serializer_class = CatalogSerializer


class CatalogDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = Catalog.objects.all()
    serializer_class = CatalogSerializer
