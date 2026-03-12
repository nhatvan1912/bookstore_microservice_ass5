from django.urls import path
from .views import RecommendationListCreate

urlpatterns = [
    path('recommendations/', RecommendationListCreate.as_view()),
]
