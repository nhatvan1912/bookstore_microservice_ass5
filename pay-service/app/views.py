from rest_framework import generics
from .models import Payment
from .serializers import PaymentSerializer


class PaymentListCreate(generics.ListCreateAPIView):
    serializer_class = PaymentSerializer

    def get_queryset(self):
        queryset = Payment.objects.all()
        order_id = self.request.query_params.get("order_id")
        status = self.request.query_params.get("status")
        if order_id:
            queryset = queryset.filter(order_id=order_id)
        if status:
            queryset = queryset.filter(status=status)
        return queryset


class PaymentDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = Payment.objects.all()
    serializer_class = PaymentSerializer
