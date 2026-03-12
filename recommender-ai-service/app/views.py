from rest_framework import generics
from .models import Recommendation
from .serializers import RecommendationSerializer

class RecommendationListCreate(generics.ListCreateAPIView):
    queryset = Recommendation.objects.all()
    serializer_class = RecommendationSerializer
