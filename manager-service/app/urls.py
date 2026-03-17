from django.urls import path
from .views import ManagerListCreate, ManagerDetail, ManagerLogin

urlpatterns = [
    path('managers/', ManagerListCreate.as_view()),
    path('managers/<int:pk>/', ManagerDetail.as_view()),
    path('managers/login/', ManagerLogin.as_view()),
]
