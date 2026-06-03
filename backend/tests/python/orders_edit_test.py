# Tests for editing an order, including applying an order-level discount.
# Runs against a live server (http://localhost:8000) using the Skyramp client,
# matching the style of the products_*.py suite.

import json
import os

import skyramp

URL = "http://localhost:8000"


def get_header():
    # A non-empty session id is required so that edits persist under a real
    # session (the API only writes through for non-default sessions).
    token = os.getenv("SKYRAMP_TEST_TOKEN", "orders-edit-test-session")
    return {"Authorization": "Bearer " + token}


def _create_order(client, headers, email="buyer@mail.com", product_id=1, quantity=2):
    body = json.dumps(
        {"customer_email": email, "items": [{"product_id": product_id, "quantity": quantity}]}
    )
    resp = client.send_request(
        url=URL, path="/api/v1/orders", method="POST", body=body, headers=headers
    )
    assert resp.status_code == 201, resp.response_body
    return json.loads(resp.response_body)


def test_edit_order_applies_discount_and_fields():
    client = skyramp.Client()
    headers = get_header()

    created = _create_order(client, headers, email="buyer@mail.com")
    order_id = created["order_id"]
    subtotal = created["total_amount"]  # no discount at creation
    assert subtotal > 0

    update_body = json.dumps(
        {"discount_percent": 10, "status": "confirmed", "customer_email": "updated@mail.com"}
    )
    resp = client.send_request(
        url=URL,
        path="/api/v1/orders/{order_id}",
        method="PUT",
        body=update_body,
        headers=headers,
        path_params={"order_id": order_id},
    )
    assert resp.status_code == 200, resp.response_body
    updated = json.loads(resp.response_body)
    assert updated["discount_percent"] == 10
    assert updated["status"] == "confirmed"
    assert updated["customer_email"] == "updated@mail.com"
    assert updated["total_amount"] == round(subtotal * 0.9, 2)

    # Confirm the change persisted.
    get_resp = client.send_request(
        url=URL,
        path="/api/v1/orders/{order_id}",
        method="GET",
        headers=headers,
        path_params={"order_id": order_id},
    )
    assert get_resp.status_code == 200, get_resp.response_body
    fetched = json.loads(get_resp.response_body)
    assert fetched["discount_percent"] == 10
    assert fetched["total_amount"] == round(subtotal * 0.9, 2)


def test_edit_nonexistent_order_returns_404():
    client = skyramp.Client()
    headers = get_header()

    resp = client.send_request(
        url=URL,
        path="/api/v1/orders/{order_id}",
        method="PUT",
        body=json.dumps({"discount_percent": 5}),
        headers=headers,
        path_params={"order_id": 999999},
    )
    assert resp.status_code == 404, resp.response_body


def test_edit_order_invalid_discount_rejected():
    client = skyramp.Client()
    headers = get_header()

    created = _create_order(client, headers, email="buyer2@mail.com")
    order_id = created["order_id"]

    resp = client.send_request(
        url=URL,
        path="/api/v1/orders/{order_id}",
        method="PUT",
        body=json.dumps({"discount_percent": 150}),
        headers=headers,
        path_params={"order_id": order_id},
    )
    # The API's custom validation handler returns 400 (not FastAPI's default 422)
    # for any invalid request body.
    assert resp.status_code == 400, resp.response_body


if __name__ == "__main__":
    test_edit_order_applies_discount_and_fields()
    test_edit_nonexistent_order_returns_404()
    test_edit_order_invalid_discount_rejected()
