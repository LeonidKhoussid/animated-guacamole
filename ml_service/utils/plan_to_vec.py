import cv2
import json
import torch
import logging
import numpy as np
import pandas as pd
from pathlib import Path
from typing import List, Tuple, Optional, Dict
from torchvision.ops import masks_to_boxes, box_area


logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
if not logger.handlers:
    ch = logging.StreamHandler()
    ch.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(ch)


class PlanTrassing:
    """ТРАССИРОВКА ПО МАСКЕ"""

    def __init__(self):
        from config import PlanToVecConfig
        self.config = PlanToVecConfig()

    def _load_and_binarize(self, image_path: Path) -> Tuple[np.ndarray, np.ndarray]:
        img = cv2.imread(str(image_path))
        if img is None:
            raise FileNotFoundError(f"Не удалось загрузить план: {image_path}")

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        _, binary = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)

        binary = self._remove_text_smart(binary)
        binary = self._smooth_contours(binary)

        return binary, img

    # Анализ формы текста и удаление
    def _remove_text_smart(self, binary: np.ndarray) -> np.ndarray:
        h, w = binary.shape
        img_area = h * w
        cfg = self.config.text_removal

        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(binary, connectivity=8)
        walls_mask = np.zeros_like(binary)

        for i in range(1, num_labels):
            area = int(stats[i, cv2.CC_STAT_AREA])
            width = int(stats[i, cv2.CC_STAT_WIDTH])
            height = int(stats[i, cv2.CC_STAT_HEIGHT])

            if area < 10:
                continue

            aspect_ratio = max(width, height) / max(min(width, height), 1)
            area_ratio = area / (width * height + 1)

            is_text = False

            # Используем настройки из конфига
            if area < img_area * cfg["min_area_ratio_1"]:
                is_text = True
            elif (area < img_area * cfg["min_area_ratio_2"] and 
                  area_ratio > cfg["min_area_ratio_2_density"] and 
                  aspect_ratio < cfg["max_aspect_ratio_2"]):
                is_text = True
            elif (area < img_area * cfg["min_area_ratio_3"] and 
                  cfg["min_aspect_ratio_3"] < aspect_ratio < cfg["max_aspect_ratio_3"] and 
                  area_ratio > cfg["min_area_ratio_3_density"]):
                is_text = True

            if not is_text:
                mask = (labels == i).astype(np.uint8) * 255
                walls_mask = cv2.bitwise_or(walls_mask, mask)

        return walls_mask

    # Сглаживание контуров
    def _smooth_contours(self, binary: np.ndarray) -> np.ndarray:
        cfg = self.config.smoothing
        kernel_size = cfg["gaussian_kernel_size"]
        smoothed = cv2.GaussianBlur(binary, (kernel_size, kernel_size), 0)
        _, smoothed = cv2.threshold(smoothed, 127, 255, cv2.THRESH_BINARY)
        morph_kernel = np.ones((cfg["morphology_kernel_size"], cfg["morphology_kernel_size"]), np.uint8)
        smoothed = cv2.morphologyEx(smoothed, cv2.MORPH_CLOSE, morph_kernel, iterations=cfg["morphology_iterations"])
        return smoothed

    # Поиск стен через connected components
    def _find_walls(self, binary: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        cfg = self.config.wall_detection
        walls_binary = binary.copy()

        kernel_size = cfg["morphology_kernel_size"]
        kernel = np.ones((kernel_size, kernel_size), np.uint8)
        walls_binary = cv2.morphologyEx(walls_binary, cv2.MORPH_CLOSE, kernel, iterations=cfg["morphology_iterations"])
        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(walls_binary, connectivity=8)

        h, w = binary.shape
        min_area = int(h * w * cfg["min_area_ratio"])

        wall_labels = np.zeros_like(labels)
        wall_ids = []

        for i in range(1, num_labels):
            area = int(stats[i, cv2.CC_STAT_AREA])
            if area >= min_area:
                wall_labels[labels == i] = len(wall_ids) + 1
                wall_ids.append(i)

        return wall_labels, labels

    # Макси и bbox (потом в тензор)
    def _create_masks_and_boxes(self, wall_labels: np.ndarray) -> Dict:
        distinct_ids = np.unique(wall_labels)
        distinct_ids = distinct_ids[distinct_ids > 0]

        if len(distinct_ids) == 0:
            return {"masks": [], "boxes": [], "labels": []}

        masks = []
        for wall_id in distinct_ids:
            mask = (wall_labels == wall_id).astype(np.uint8)
            masks.append(mask)

        masks_tensor = torch.tensor(np.array(masks), dtype=torch.uint8)

        boxes = masks_to_boxes(masks_tensor)

        areas = box_area(boxes)
        non_empty = torch.where(areas > 0)[0]

        final_masks = masks_tensor[non_empty]
        final_boxes = boxes[non_empty]
        final_labels = torch.ones((len(final_boxes),), dtype=torch.int64)

        return {
            "masks": final_masks.numpy(),
            "boxes": final_boxes.numpy(),
            "labels": final_labels.numpy()
        }

    # Поиск квартиры через самую большую область
    def _find_apartment_region(self, binary: np.ndarray) -> Optional[Tuple[int, int, int, int]]:
        cfg = self.config.apartment_detection
        rooms_binary = cv2.bitwise_not(binary)
        kernel_size = cfg["morphology_kernel_size"]
        kernel = np.ones((kernel_size, kernel_size), np.uint8)
        rooms_binary = cv2.morphologyEx(rooms_binary, cv2.MORPH_CLOSE, kernel, iterations=cfg["morphology_iterations"])
        num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(rooms_binary, connectivity=8)

        if num_labels < 2:
            return None

        areas = [int(stats[i, cv2.CC_STAT_AREA]) for i in range(1, num_labels)]
        max_idx = np.argmax(areas) + 1

        x = int(stats[max_idx, cv2.CC_STAT_LEFT])
        y = int(stats[max_idx, cv2.CC_STAT_TOP])
        width = int(stats[max_idx, cv2.CC_STAT_WIDTH])
        height = int(stats[max_idx, cv2.CC_STAT_HEIGHT])

        return (x, y, x + width, y + height)

    # Обрезка по bbox
    def _crop_region(self, img: np.ndarray, binary: np.ndarray, bbox: Tuple[int, int, int, int],
                     padding: Optional[int] = None) -> Tuple[np.ndarray, np.ndarray]:
        if padding is None:
            padding = self.config.cropping["padding"]
        x_min, y_min, x_max, y_max = bbox
        x_min = max(0, x_min - padding)
        y_min = max(0, y_min - padding)
        x_max = min(img.shape[1], x_max + padding)
        y_max = min(img.shape[0], y_max + padding)
        return img[y_min:y_max, x_min:x_max], binary[y_min:y_max, x_min:x_max]

    # Масштабирование с сохранением пропорций и центрированием
    def _resize(self, img: np.ndarray, target_size: Optional[Tuple[int, int]] = None) -> np.ndarray:
        if target_size is None:
            target_size = (self.config.target_width, self.config.target_height)

        target_w, target_h = target_size
        h, w = img.shape[:2]

        if w == 0 or h == 0:
            return np.zeros((target_h, target_w), dtype=img.dtype)

        scale = min(target_w / w, target_h / h)
        new_w = max(1, int(w * scale))
        new_h = max(1, int(h * scale))

        resized = cv2.resize(img, (new_w, new_h), interpolation=cv2.INTER_LINEAR)
        canvas = np.zeros((target_h, target_w), dtype=img.dtype)
        y_offset = (target_h - new_h) // 2
        x_offset = (target_w - new_w) // 2
        canvas[y_offset:y_offset + new_h, x_offset:x_offset + new_w] = resized
        return canvas

    # Процессинг
    def process_image(self, image_path: Path) -> Optional[Dict]:
        try:
            binary, original = self._load_and_binarize(image_path)
            wall_labels, _ = self._find_walls(binary)
            wall_data = self._create_masks_and_boxes(wall_labels)
            apartment_bbox = self._find_apartment_region(binary)

            if apartment_bbox is None:
                logger.warning(f"Квартира не найдена в {image_path.name}")
                return None
            apartment_img, apartment_binary = self._crop_region(original, binary, apartment_bbox)
            resized = self._resize(apartment_binary)
            vector = resized.flatten()

            return {
                "file_name": image_path.name,
                "vector": vector,
                "resized_image": cv2.cvtColor(resized, cv2.COLOR_GRAY2BGR),
                "image_shape": resized.shape,
                "original_size": original.shape[:2],
                "apartment_bbox": apartment_bbox,
                "wall_masks": wall_data["masks"],
                "wall_boxes": wall_data["boxes"],
                "wall_labels": wall_data["labels"],
            }
        except Exception as e:
            logger.exception(f"Ошибка обработки {image_path.name}: {e}")
            return None

    # Основная функция
    def run_pipeline(self, input_dir: Optional[Path] = None) -> pd.DataFrame:
        if input_dir is None:
            input_dir = Path(self.config.input_dir)
        else:
            input_dir = Path(input_dir)

        image_files: List[Path] = []
        for ext in self.config.image_ext:
            image_files.extend(sorted(input_dir.glob(f"*{ext}")))

        results = []
        images_dir = Path(self.config.images_output_dir)
        masks_dir = Path(self.config.masks_output_dir)

        for idx, img_path in enumerate(image_files):
            if not img_path.is_file():
                continue

            logger.info(f"Обработка {img_path.name} ({idx + 1}/{len(image_files)})")
            result = self.process_image(img_path)
            if result:
                # Сохранение изображения
                img_save_path = images_dir / f"normalized_{result['file_name']}"
                cv2.imwrite(str(img_save_path), result["resized_image"])
                result["resized_path"] = str(img_save_path)
                
                # Сохранение масок
                if len(result["wall_masks"]) > 0:
                    mask_save_path = masks_dir / f"{Path(result['file_name']).stem}_masks.npy"
                    np.save(str(mask_save_path), result["wall_masks"])
                    result["mask_path"] = str(mask_save_path)
                else:
                    result["mask_path"] = None
                
                result["vector_idx"] = len(results)
                results.append(result)

        if not results:
            logger.warning("Нет обработанных")
            return pd.DataFrame()

        df_data = []
        for r in results:
            df_data.append({
                "file_name": r["file_name"],
                "original_height": r["original_size"][0],
                "original_width": r["original_size"][1],
                "resized_height": r["image_shape"][0],
                "resized_width": r["image_shape"][1],
                "vector_size": len(r["vector"]),
                "num_walls": len(r["wall_labels"]),
                "apartment_bbox": str(r["apartment_bbox"]),
                "resized_path": r.get("resized_path", ""),
                "mask_path": r.get("mask_path", ""),
                "vector_idx": r.get("vector_idx", -1),
                "wall_boxes": r["wall_boxes"].tolist() if isinstance(r["wall_boxes"], np.ndarray) else r["wall_boxes"],
                "wall_labels": r["wall_labels"].tolist() if isinstance(r["wall_labels"], np.ndarray) else r["wall_labels"],
                "image_shape": str(r["image_shape"]),
            })

        df = pd.DataFrame(df_data)

        # Вектора
        vectors_path = Path(self.config.vectors_output_file)
        vectors = np.array([r["vector"] for r in results])
        np.save(vectors_path, vectors)
        logger.info(f"Векторы сохранены: {vectors_path}")

        # JSON
        json_path = Path(self.config.json_output_file)
        records = df.to_dict(orient="records")
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(records, f, ensure_ascii=False, indent=2)
        logger.info(f"Метаданные сохранены: {json_path}")
        logger.info(f"Обработано планов: {len(results)}")

        return df


# from ml_service.utils.plan_to_vec import PlanTrassing
# # Запуск
# if __name__ == "__main__":
#     processor = PlanTrassing()
#     df = processor.run_pipeline()
