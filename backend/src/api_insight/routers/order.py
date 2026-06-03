"""
Order API
"""
from typing import List, Annotated
from fastapi import APIRouter, Query, Path
from api_insight.deps import CacheDep, GetSessionIdDep, EnsureSessionDep
from api_insight.exceptions import ResourceNotFoundException
from api_insight.models.order import (
    OrderCreate, OrderRead, OrderCancel, OrderUpdate
)
from api_insight.models.params import QueryParams
from api_insight.crud import orders

router = APIRouter(
    prefix="/orders",
    tags=["orders"],
    dependencies=[EnsureSessionDep]
)

@router.post("", response_model=OrderRead, status_code=201,
            summary="Create a new order",
            description="Create a new order with the specified products and quantities")
async def create_order(
    order: OrderCreate,
    cache: CacheDep,
    session_id: GetSessionIdDep
):
    """
    Create a new order
    """
    try:
        db_order = orders.create_order(cache, session_id, order)
        db_order.items = orders.get_order_items(cache, session_id, db_order.order_id)
        return db_order
    except ValueError as exc:
        raise ResourceNotFoundException(status_code=404, detail="Invalid product id") from exc

@router.get("", response_model=List[OrderRead],
           summary="Get all orders",
           description="Retrieve all orders with optional filtering")
async def get_orders(
    cache: CacheDep,
    session_id: GetSessionIdDep,
    query_params: Annotated[QueryParams, Query()],
):
    """
    Get all orders
    """
    order_list = orders.get_orders(
        cache,
        session_id,
        query_params.limit,
        query_params.offset,
        query_params.order,
        order_by="order_id" if query_params.orderBy is None else query_params.orderBy
    )
    return order_list

@router.get("/{order_id}", response_model=OrderRead,
           summary="Get order by ID",
           description="Retrieve a specific order by its ID")
async def get_order(
    order_id: Annotated[int, Path(json_schema_extra={'example': 0})],
    cache: CacheDep,
    session_id: GetSessionIdDep
):
    """
    Get a specific order by its ID
    """
    order = orders.get_order(cache, session_id, order_id)
    if not order:
        raise ResourceNotFoundException(status_code=404, detail="Order not found")
    order.items = orders.get_order_items(cache, session_id, order_id)
    return order

@router.put("/{order_id}", response_model=OrderRead,
           summary="Edit an order",
           description="Update an order's customer email, status, or discount. "
                       "The total is recomputed from the order's items.")
async def update_order(
    order_id: Annotated[int, Path(json_schema_extra={'example': 0})],
    order_update: OrderUpdate,
    cache: CacheDep,
    session_id: GetSessionIdDep
):
    """
    Edit an existing order
    """
    order = orders.update_order(cache, session_id, order_id, order_update)
    if not order:
        raise ResourceNotFoundException(status_code=404, detail="Order not found")
    return order

@router.delete("/{order_id}",
              summary="Cancel order",
              description="Cancel an existing order",
              response_model=OrderCancel)
async def cancel_order(
    order_id: Annotated[int, Path(json_schema_extra={'example': 0})],
    cache: CacheDep,
    session_id: GetSessionIdDep
):
    """
    Cancel an existing order
    """
    try:
        orders.cancel_order(cache, session_id, order_id)
    except ValueError as exc:
        raise ResourceNotFoundException(status_code=404, detail="Order not found") from exc
    return OrderCancel(message="Order cancelled successfully")
