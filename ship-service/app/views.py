from rest_framework import generics
from .models import Shipment
from .serializers import ShipmentSerializer


class ShipmentListCreate(generics.ListCreateAPIView):
    serializer_class = ShipmentSerializer

    def get_queryset(self):
        queryset = Shipment.objects.all()
        order_id = self.request.query_params.get("order_id")
        status = self.request.query_params.get("status")
        if order_id:
            queryset = queryset.filter(order_id=order_id)
        if status:
            queryset = queryset.filter(status=status)
        return queryset


class ShipmentDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = Shipment.objects.all()
    serializer_class = ShipmentSerializer
