from rest_framework import generics
from rest_framework.response import Response
from .models import Review
from .serializers import ReviewSerializer
import requests

ORDER_SERVICE_URL = "http://order-service:8000"

class ReviewListCreate(generics.ListCreateAPIView):
    serializer_class = ReviewSerializer

    def get_queryset(self):
        queryset = Review.objects.all()
        book_id = self.request.query_params.get('book_id', None)
        customer_id = self.request.query_params.get('customer_id', None)
        if book_id is not None:
            queryset = queryset.filter(book_id=book_id)
        if customer_id is not None:
            queryset = queryset.filter(customer_id=customer_id)
        return queryset

    def create(self, request, *args, **kwargs):
        customer_id = request.data.get('customer_id')
        book_id = request.data.get('book_id')
        if customer_id is None or book_id is None:
            return Response({'error': 'customer_id and book_id are required'}, status=400)

        if Review.objects.filter(customer_id=customer_id, book_id=book_id).exists():
            return Response({'error': 'Review already exists for this purchased book'}, status=400)

        try:
            resp = requests.get(
                f"{ORDER_SERVICE_URL}/orders/",
                params={'customer_id': customer_id},
                timeout=15,
            )
            if resp.status_code != 200:
                return Response({'error': 'Cannot verify purchase history'}, status=502)
            orders = resp.json()
        except Exception as exc:
            return Response({'error': 'Cannot verify purchase history', 'details': str(exc)}, status=502)

        purchased = False
        for order in orders:
            status = str(order.get('status', '')).lower()
            if status != 'confirm':
                continue
            for item in order.get('items', []):
                if int(item.get('book_id', -1)) == int(book_id):
                    purchased = True
                    break
            if purchased:
                break

        if not purchased:
            return Response({'error': 'You can only review books that you have purchased'}, status=403)

        return super().create(request, *args, **kwargs)


class ReviewDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = Review.objects.all()
    serializer_class = ReviewSerializer
