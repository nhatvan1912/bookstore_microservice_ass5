from rest_framework import generics
from .models import Book
from .serializers import BookSerializer

class BookListCreate(generics.ListCreateAPIView):
    serializer_class = BookSerializer

    def get_queryset(self):
        queryset = Book.objects.all()
        keyword = self.request.query_params.get("q")
        author = self.request.query_params.get("author")
        category = self.request.query_params.get("category")
        if keyword:
            queryset = queryset.filter(title__icontains=keyword)
        if author:
            queryset = queryset.filter(author__icontains=author)
        if category:
            queryset = queryset.filter(category=category)
        return queryset

class BookDetail(generics.RetrieveUpdateDestroyAPIView):
    queryset = Book.objects.all()
    serializer_class = BookSerializer
