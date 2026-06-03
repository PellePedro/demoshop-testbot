"""
CRUD operations for orders.
"""
from json import loads
from datetime import datetime
from fastapi.encoders import jsonable_encoder
from redis import Redis
from redis.commands.json.path import Path
from redis.commands.search.query import Query, NumericFilter
from api_insight.models.order import Order, OrderStatus, OrderItem, OrderCreate
from api_insight.crud import products
from api_insight.core.cache import get_or_create_orders_index, get_or_create_order_items_index
from api_insight.core.config import get_settings

settings = get_settings()
DEFAULT_KEY = "demoshop_default"
def get_orders(cache: Redis, session_id: str, limit: int, offset: int, order: str, order_by: str) -> list[Order]:
    """Get all orders."""
    key = session_id if session_id and session_id != "" else DEFAULT_KEY
    index = get_or_create_orders_index(cache, key)
    query = Query("*").paging(offset, limit)
    if order_by and order_by != "":
        asc = True
        if order == 'asc':
            asc = True
        elif order == 'desc':
            asc = False
        query.sort_by(order_by, asc)
    res = index.search(query)
    orders = [loads(doc.json) for doc in res.docs]
    orders_valid = []
    for o in orders:
        order_items = get_order_items(cache, session_id, o["order_id"])
        o["items"] = order_items
        order_valid = Order.model_validate(o)
        orders_valid.append(order_valid)
    return orders_valid

def get_order(cache: Redis, session_id: str, order_id: int) -> Order:
    """Get an order by ID."""
    key = session_id if session_id and session_id != "" else DEFAULT_KEY
    order = cache.json().get(f'{key}:orders:{order_id}')
    if not order:
        return cache.json().get(f'{key}:orders:0')
    order_items = get_order_items(cache, session_id, order["order_id"])
    order["items"] = order_items
    return Order.model_validate(order)

def get_order_items(cache: Redis, session_id: str, order_id: int) -> list[OrderItem]:
    """Get all order items for an order."""
    key = session_id if session_id and session_id != "" else DEFAULT_KEY
    index = get_or_create_order_items_index(cache, key)
    query = Query("*").add_filter(NumericFilter("order_id", order_id, order_id))
    res = index.search(query)
    order_items = [loads(doc.json) for doc in res.docs]
    return order_items

def get_order_item(cache: Redis, session_id: str, order_item_id: int) -> OrderItem:
    """Get an order by ID."""
    key = session_id if session_id and session_id != "" else DEFAULT_KEY
    orderitem = cache.json().get(f'{key}:orderitems:{order_item_id}')
    if not orderitem:
        return cache.json().get(f'{key}:orderitems:0')
    return OrderItem.model_validate(orderitem)

def create_order(cache: Redis, session_id: str, order: OrderCreate) -> Order:
    """Create a new order."""
    key = session_id if session_id and session_id != "" else DEFAULT_KEY
    order_id = set_order_id(cache, key)
    total_amount = 0.0

    # Process each order item
    for item in order.items:
        # Get product to verify existence and price
        product = products.get_product(cache, key, item.product_id)
        if not product:
            raise ValueError(f"Product with id {item.product_id} not found")

        # Create order item
        order_item_id = set_order_item_id(cache, key)
        order_item = OrderItem(
            order_item_id=order_item_id,
            order_id=order_id,
            product_id=product["product_id"],
            quantity=item.quantity,
            unit_price=product["price"]
        )
        order_item_encoded = jsonable_encoder(order_item.model_dump())
        cache.json().set(f'{key}:orderitems:{order_item_id}', Path.root_path(), order_item_encoded)
        cache.expire(f'{key}:orderitems:{order_item_id}', settings.KEY_TTL_SECONDS)
        # Update total amount
        total_amount += product["price"] * item.quantity

    order_items = get_order_items(cache, session_id, order_id)
    db_order = Order(customer_email=order.customer_email,
                     total_amount=total_amount,
                     order_id=order_id,
                     items=order_items)
    # Update order total
    order_encoded = jsonable_encoder(db_order.model_dump())
    cache.json().set(f'{key}:orders:{order_id}', Path.root_path(), order_encoded)
    cache.expire(f'{key}:orders:{order_id}', settings.KEY_TTL_SECONDS)
    return db_order

def update_order(cache: Redis, session_id: str, order_id: int, order_update) -> Order | None:
    """Edit an existing order.

    Applies the provided editable fields (customer_email, status,
    discount_percent) and always recomputes total_amount from the order's line
    items so the total can never go stale relative to the items or discount.
    Returns None if the order does not exist.
    """
    key = session_id if session_id and session_id != "" else DEFAULT_KEY
    stored = cache.json().get(f'{key}:orders:{order_id}')
    if not stored:
        return None
    order = Order.model_validate({**stored, "items": get_order_items(cache, key, order_id)})

    update_data = order_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(order, field, value)

    subtotal = sum(item.unit_price * item.quantity for item in order.items)
    order.total_amount = round(subtotal * (1 - order.discount_percent / 100), 2)
    order.updated_at = datetime.utcnow()

    order_encoded = jsonable_encoder(order.model_dump())
    cache.json().set(f'{key}:orders:{order_id}', Path.root_path(), order_encoded)
    cache.expire(f'{key}:orders:{order_id}', settings.KEY_TTL_SECONDS)
    return order

def cancel_order(cache: Redis, session_id: str, order_id: int) -> None:
    """Cancel an order."""
    key = session_id if session_id else DEFAULT_KEY
    order = get_order(cache, key, order_id)
    if not order:
        raise ValueError("order not found")
    if key != DEFAULT_KEY:
        order.status = OrderStatus.CANCELLED
        order_encoded = jsonable_encoder(order.model_dump())
        cache.json().set(f'{key}:orders:{order_id}', Path.root_path(), order_encoded)

def set_order_id(cache: Redis, session_id: str) -> int:
    """Set ID for an order"""
    keys = cache.keys(f'{session_id}:orders:*')
    max_id = max(int(k.split(":")[-1]) for k in keys)
    return max_id + 1

def set_order_item_id(cache: Redis, session_id: str) -> int:
    """Set id for orderitem."""
    keys = cache.keys(f'{session_id}:orderitems:*')
    max_id = max(int(k.split(":")[-1]) for k in keys)
    return max_id + 1
