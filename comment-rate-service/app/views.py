from rest_framework import generics
from .models import Review
from .serializers import ReviewSerializer

class ReviewListCreate(generics.ListCreateAPIView):
    serializer_class = ReviewSerializer

    def get_queryset(self):
        queryset = Review.objects.all()
        book_id = self.request.query_params.get('book_id', None)
        if book_id is not None:
            queryset = queryset.filter(book_id=book_id)
        return queryset


class ReviewDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = Review.objects.all()
    serializer_class = ReviewSerializer
