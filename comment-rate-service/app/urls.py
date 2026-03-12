from django.urls import path
from .views import ReviewListCreate

urlpatterns = [
    path('reviews/', ReviewListCreate.as_view()),
]
