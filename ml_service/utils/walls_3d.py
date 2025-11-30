import logging
import trimesh
import numpy as np
from pathlib import Path
from typing import List, Optional
import xml.etree.ElementTree as ET
from svgelements import Path as SvgPath
from shapely.ops import unary_union, linemerge, snap
from shapely.geometry import LineString, MultiLineString

from config import Plan3DConfig


logger = logging.getLogger("svg2walls3d")
logger.setLevel(logging.INFO)
if not logger.handlers:
    h = logging.StreamHandler()
    h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(h)


class SVGWalls3D:
    """ТРИАНГУЛЯЦИЯ В OBJ"""

    @staticmethod
    def path_to_poly(d: str, steps: int = 50, min_len: float = 5.0) -> List[LineString]:
        path = SvgPath(d)
        out = []
        for seg in path:
            if not seg.start or not seg.end:
                continue
            pts = [seg.point(t / steps) for t in range(steps + 1)]
            coords = [(p.x, p.y) for p in pts]
            for i in range(len(coords) - 1):
                x1, y1 = coords[i]
                x2, y2 = coords[i + 1]
                if np.hypot(x2 - x1, y2 - y1) >= min_len:
                    out.append(LineString([(x1, y1), (x2, y2)]))
        return out

    @staticmethod
    def svg_to_segments(path: Path, steps=50, min_len=5.0):
        root = ET.parse(path).getroot()
        segs = []
        count = 0
        for el in root.iter():
            if el.tag.split('}')[-1] != "path":
                continue
            d = el.get("d")
            if not d:
                continue
            count += 1
            segs.extend(SVGWalls3D.path_to_poly(d, steps, min_len))
        logger.info(f"Найдено путей: {count}, сегментов: {len(segs)}")
        return segs

    @staticmethod
    def preprocess(segs: List[LineString], eps=1e-3, min_len=5.0):
        out = []
        for ln in segs:
            (x1, y1), (x2, y2) = ln.coords
            if np.hypot(x2 - x1, y2 - y1) < min_len:
                continue
            out.append(snap(ln, ln, eps))
        return out

    @staticmethod
    def merge(segs: List[LineString]):
        if not segs:
            return []
        m = linemerge(unary_union(segs))
        if isinstance(m, LineString):
            return [m]
        if isinstance(m, MultiLineString):
            return list(m.geoms)
        return []

    @staticmethod
    def find_corners(line: LineString, deg: float = 15.0):
        c = np.array(line.coords)
        if len(c) < 3:
            return np.array([0, len(c) - 1])
        out = [0]
        th = np.radians(deg)
        for i in range(1, len(c) - 1):
            v1 = c[i] - c[i - 1]
            v2 = c[i + 1] - c[i]
            n1, n2 = np.linalg.norm(v1), np.linalg.norm(v2)
            if n1 < 1e-6 or n2 < 1e-6:
                continue
            a = np.arccos(np.clip(np.dot(v1 / n1, v2 / n2), -1, 1))
            if a < (np.pi - th):
                out.append(i)
        out.append(len(c) - 1)
        return np.array(out)

    @staticmethod
    def split(line: LineString, deg: float = 15.0):
        c = np.array(line.coords)
        if len(c) < 2:
            return [line]
        idx = SVGWalls3D.find_corners(line, deg)
        out = []
        for i in range(len(idx) - 1):
            s, e = idx[i], idx[i + 1]
            seg = c[s:e + 1]
            if len(seg) >= 2:
                out.append(LineString(seg))
        return out or [line]

    @staticmethod
    def extrude(line: LineString, thick: float, h: float, scale: float):
        poly = LineString(np.array(line.coords) * scale).buffer(thick / 2, cap_style=2, join_style=2)
        return trimesh.creation.extrude_polygon(poly, h, engine="earcut")

    @staticmethod
    def convert(svg_path: str, out_path: str,
                thick: float = 0.2, h: float = 3.0,
                steps: int = 50, min_len: float = 6.0):
        svg = Path(svg_path)
        out = Path(out_path)

        seg_raw = SVGWalls3D.svg_to_segments(svg, steps, min_len)
        if not seg_raw:
            raise RuntimeError("Нет сегментов")

        k = 0.01
        logger.info(f"px→m: {k}")

        seg_clean = SVGWalls3D.preprocess(seg_raw, min_len=min_len)
        merged = SVGWalls3D.merge(seg_clean)

        walls = []
        for ln in merged:
            walls.extend(SVGWalls3D.split(ln, 15.0))

        logger.info(f"Стены: {len(walls)}")
        if not walls:
            raise RuntimeError("Стены не сформированы")

        meshes = []
        for i, w in enumerate(walls, 1):
            try:
                m = SVGWalls3D.extrude(w, thick, h, k)
                meshes.append(m)
                logger.info(f"Стена {i}/{len(walls)}")
            except Exception as e:
                logger.warning(f"Ошибка стены {i}: {e}")

        if not meshes:
            raise RuntimeError("Меши не созданы")

        trimesh.util.concatenate(meshes).export(out)
        logger.info(f"Готово: {out}")

    @staticmethod
    def process_folders(input_base_dir: Path, config: Optional[Plan3DConfig] = None):
        if config is None:
            config = Plan3DConfig()
        
        base_dir = Path(input_base_dir)
        if not base_dir.exists() or not base_dir.is_dir():
            raise ValueError(f"Базовая папка не найдена: {base_dir}")
        
        folders = [d for d in base_dir.iterdir() if d.is_dir()]
        if not folders:
            logger.warning(f"Подпапки не найдены в {base_dir}")
            return
        
        output_dir = Path(config.output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)
        
        for folder in folders:
            logger.info(f"Обработка папки: {folder.name}")
            
            svg_files = list(folder.glob("*.svg"))
            image_files = []
            for ext in config.image_ext:
                image_files.extend(folder.glob(f"*{ext}"))
            
            if not svg_files:
                logger.warning(f"SVG файлы не найдены в {folder.name}")
                continue
            
            base_name = folder.name
            output_name = f"{base_name}_walls"
            output_path = output_dir / f"{output_name}.obj"
            
            svg_file = svg_files[0]
            if len(svg_files) > 1:
                logger.warning(f"Несколько SVG файлов в {folder.name}, используется первый: {svg_file.name}")
            
            logger.info(f"Обработка {folder.name}/{svg_file.name} -> {output_path.name}")
            
            try:
                SVGWalls3D.convert(
                    str(svg_file),
                    str(output_path),
                    thick=config.wall_thickness,
                    h=config.wall_height,
                    steps=config.steps,
                    min_len=config.min_length
                )
                logger.info(f"Успешно: {output_path}")
            except Exception as e:
                logger.error(f"Ошибка обработки {folder.name}: {e}")


# from ml_service.utils.walls_3d import SVGWalls3D
# from config import Plan3DConfig
# from pathlib import Path
# # Запуск
# if __name__ == "__main__":
#     config = Plan3DConfig()
#     SVGWalls3D.process_folders(Path(config.input_dir), config)

