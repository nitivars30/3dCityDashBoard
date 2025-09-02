from shapely.geometry import shape

def geom_from_geojson(geojson_geom):
    return shape(geojson_geom)

def centroid_lonlat(geojson_geom):
    g = shape(geojson_geom)
    c = g.centroid
    return c.x, c.y
