"""Add reef_sites table seeded from static data

Revision ID: 009
Revises: 008
Create Date: 2026-06-23
"""
from alembic import op
import sqlalchemy as sa

revision = '009'
down_revision = '008'
branch_labels = None
depends_on = None

_STATIC_SITES = [
    {"id": "hanauma_bay",        "name": "Hanauma Bay",          "island": "Oahu",         "lat": 21.2692, "lng": -157.6940, "depth_m": 3.0,  "mmm_c": 27.5, "description": "Protected marine life conservation district, famous for snorkeling."},
    {"id": "kaneohe_bay",        "name": "Kaneohe Bay",           "island": "Oahu",         "lat": 21.4389, "lng": -157.8019, "depth_m": 6.0,  "mmm_c": 27.8, "description": "Largest barrier reef in the US, with patch reefs and sandbar."},
    {"id": "sharks_cove",        "name": "Shark's Cove",          "island": "Oahu",         "lat": 21.6490, "lng": -158.0596, "depth_m": 9.0,  "mmm_c": 27.2, "description": "Popular north shore tide pool and snorkeling site."},
    {"id": "molokini",           "name": "Molokini Crater",       "island": "Maui",         "lat": 20.6317, "lng": -156.4957, "depth_m": 15.0, "mmm_c": 27.9, "description": "Submerged volcanic crater with exceptional visibility."},
    {"id": "honolua_bay",        "name": "Honolua Bay",           "island": "Maui",         "lat": 21.0095, "lng": -156.6388, "depth_m": 12.0, "mmm_c": 27.5, "description": "Marine Life Conservation District, vibrant coral ecosystem."},
    {"id": "kealakekua_bay",     "name": "Kealakekua Bay",        "island": "Hawaii",       "lat": 19.4778, "lng": -155.9298, "depth_m": 10.0, "mmm_c": 27.3, "description": "State underwater park with spinner dolphins and pristine coral."},
    {"id": "kona_coast",         "name": "Kona Coast Reef",       "island": "Hawaii",       "lat": 19.6400, "lng": -156.0000, "depth_m": 8.0,  "mmm_c": 27.6, "description": "Rich lava shelf reef system along west Hawaii."},
    {"id": "tunnels_reef",       "name": "Tunnels Reef",          "island": "Kauai",        "lat": 22.2247, "lng": -159.5757, "depth_m": 18.0, "mmm_c": 27.0, "description": "Dramatic lava tube reef system on Kauai's north shore."},
    {"id": "poipu",              "name": "Poipu Beach Reef",      "island": "Kauai",        "lat": 21.8727, "lng": -159.4547, "depth_m": 5.0,  "mmm_c": 27.4, "description": "Sheltered south Kauai reef, popular for monk seal sightings."},
    {"id": "french_frigate",     "name": "French Frigate Shoals", "island": "Northwestern", "lat": 23.8000, "lng": -166.1500, "depth_m": 20.0, "mmm_c": 28.0, "description": "Remote atoll in Papahānaumokuākea, critical monk seal habitat."},
    {"id": "midway_atoll",       "name": "Midway Atoll",          "island": "Northwestern", "lat": 28.2072, "lng": -177.3735, "depth_m": 25.0, "mmm_c": 26.5, "description": "Remote reef ecosystem, home to world's largest albatross colony."},
]


def upgrade() -> None:
    reef_sites = op.create_table(
        'reef_sites',
        sa.Column('id', sa.String(100), nullable=False),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('island', sa.String(100), nullable=False),
        sa.Column('lat', sa.Float(), nullable=False),
        sa.Column('lng', sa.Float(), nullable=False),
        sa.Column('depth_m', sa.Float(), nullable=False),
        sa.Column('mmm_c', sa.Float(), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.bulk_insert(reef_sites, _STATIC_SITES)


def downgrade() -> None:
    op.drop_table('reef_sites')
