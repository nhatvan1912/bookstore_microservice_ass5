from django.db import models

class Staff(models.Model):
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=100)
    password = models.CharField(
        max_length=255,
        default="pbkdf2_sha256$600000$zXFp5HkvKL3kyCadHBfGBa$hpKuNK3ER9niB8sx3jlWMFz0Z43kvpCqp5QF/amxXqw=",
    )
