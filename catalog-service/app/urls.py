from django.urls import path
from .views import CatalogListCreate

urlpatterns = [
    path('catalogs/', CatalogListCreate.as_view()),
]
