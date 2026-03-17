from django.urls import path
from .views import RecommendationListCreate, RecommendationDetail

urlpatterns = [
    path('recommendations/', RecommendationListCreate.as_view()),
    path('recommendations/<int:pk>/', RecommendationDetail.as_view()),
]
