from django.db import models

class Cart(models.Model):
    customer_id = models.IntegerField(unique=True)

class CartItem(models.Model):
    cart = models.ForeignKey(Cart, related_name='items', on_delete=models.CASCADE)
    book_id = models.IntegerField()
    quantity = models.IntegerField()
