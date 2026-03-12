from django.urls import path
from .views import OrderCreate

urlpatterns = [
    path('orders/', OrderCreate.as_view()),
]
