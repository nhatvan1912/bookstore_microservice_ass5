from django.db import models

class Book(models.Model):
    class Category(models.TextChoices):
        FICTION = "fiction", "Fiction"
        NON_FICTION = "non_fiction", "Non-Fiction"
        TECHNOLOGY = "technology", "Technology"
        BUSINESS = "business", "Business"
        SCIENCE = "science", "Science"
        CHILDREN = "children", "Children"
        OTHER = "other", "Other"

    title = models.CharField(max_length=255)
    author = models.CharField(max_length=255)
    category = models.CharField(max_length=32, choices=Category.choices, default=Category.OTHER)
    description = models.TextField(blank=True, default="")
    image_url = models.URLField(blank=True, default="")
    price = models.DecimalField(max_digits=10, decimal_places=2)
    stock = models.IntegerField(default=0)
