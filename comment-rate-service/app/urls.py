from django.urls import path
from .views import ReviewDetail, ReviewListCreate

urlpatterns = [
    path('reviews/', ReviewListCreate.as_view()),
    path('reviews/<int:pk>/', ReviewDetail.as_view()),
]
