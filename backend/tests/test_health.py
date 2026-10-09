"""
Health endpoint test: every store of the test compose answers.
This work made by Anfinogentov Nikita
"""


async def test_health_reports_every_store(client):
    response = await client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "stores": {"postgres": True, "redis": True, "mongo": True, "clickhouse": True},
    }
