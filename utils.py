"""General-purpose helpers shared across the toolkit.

This module is for small, dependency-free utilities that do not belong to a
specific domain (NPCs, encounters, storage). Keeping them here prevents
circular imports between domain modules.
"""


def format_terrain_name(terrain):
    """Convert internal keys like 'planar_fire' into display text."""
    # Split on underscores so multi-word terrains read naturally in CLI output.
    return " ".join(part.capitalize() for part in terrain.split("_"))
