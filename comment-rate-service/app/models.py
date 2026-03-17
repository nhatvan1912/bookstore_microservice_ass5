from django.db import models

class Review(models.Model):
    customer_id = models.IntegerField()
    book_id = models.IntegerField()
    rating = models.IntegerField()
    comment = models.TextField()
    reply = models.TextField(blank=True, default="")
    replied_by_staff_id = models.IntegerField(null=True, blank=True)
