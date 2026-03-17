from rest_framework import generics
from .models import Recommendation
from .serializers import RecommendationSerializer


class RecommendationListCreate(generics.ListCreateAPIView):
    serializer_class = RecommendationSerializer

    def get_queryset(self):
        queryset = Recommendation.objects.all()
        customer_id = self.request.query_params.get("customer_id")
        book_id = self.request.query_params.get("book_id")
        if customer_id:
            queryset = queryset.filter(customer_id=customer_id)
        if book_id:
            queryset = queryset.filter(book_id=book_id)
        return queryset


class RecommendationDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = Recommendation.objects.all()
    serializer_class = RecommendationSerializer
