from django.db import models

class Customer(models.Model):
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    password = models.CharField(
        max_length=255,
        default="pbkdf2_sha256$600000$o7Ypoz6CJGfWgGT9ujMY4h$ouCSB8rz+82ircI1LBrYBhH6Lfcmbv9T2M1wqxWiJBY=",
    )
