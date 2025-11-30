import cv2
import torch
import logging
import numpy as np
from pathlib import Path
from typing import Union, Dict, Optional
from mmdet.apis import init_detector, inference_detector


logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
if not logger.handlers:
    ch = logging.StreamHandler()
    ch.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(ch)


class BBoxDetector:
    """ДЕТЕКЦИЯ BBOX НА ПЛАНАХ"""

    def __init__(self, config: Optional = None):
        from config import BBoxDetectorConfig, CUDAConfig
        
        self.config = config if config else BBoxDetectorConfig()
        cuda_cfg = CUDAConfig()
        self.device = torch.device(cuda_cfg.device if torch.cuda.is_available() else 'cpu')
        
        self.wall_class_id = self.config.wall_class_id
        self.room_class_id = self.config.room_class_id
        self.model = None
        self._load_model()

    def _load_model(self):
        config_path = Path(self.config.configs_dir) / self.config.config_file
        checkpoint_path = Path(self.config.weights_dir) / self.config.checkpoint_file
        
        if not config_path.exists():
            logger.error(f"Конфиг не найден: {config_path}")
            return None
        
        if not checkpoint_path.exists():
            logger.error(f"Чекпоинт не найден: {checkpoint_path}")
            return None
        
        try:
            logger.info(f"Загрузка модели: {config_path.name}")
            self.model = init_detector(str(config_path), str(checkpoint_path), device=self.device)
            logger.info(f"Модель загружена на {self.device}")
        except Exception as e:
            logger.error(f"Ошибка при загрузке модели: {e}")
            self.model = None

    def detect(self, image_path_or_array: Union[str, Path, np.ndarray], 
               score_threshold: Optional[float] = None) -> Optional[Dict]:
        if self.model is None:
            logger.error("Модель не загружена")
            return None
        
        if score_threshold is None:
            score_threshold = self.config.score_threshold
        
        try:
            from mmdet.structures import DetDataSample
            
            if isinstance(image_path_or_array, (str, Path)):
                image_path = Path(image_path_or_array)
                if not image_path.exists():
                    logger.error(f"Изображение не найдено: {image_path}")
                    return None
                result = inference_detector(self.model, str(image_path))
            elif isinstance(image_path_or_array, np.ndarray):
                if len(image_path_or_array.shape) == 2:
                    image_path_or_array = cv2.cvtColor(image_path_or_array, cv2.COLOR_GRAY2BGR)
                result = inference_detector(self.model, image_path_or_array)
            else:
                logger.error("Изображение должно быть np массивом!")
                return None

            wall_bboxes = []
            room_bboxes = []

            if isinstance(result, DetDataSample):
                pred_instances = result.pred_instances
                if pred_instances is not None:
                    labels = pred_instances.labels.cpu().numpy()
                    bboxes = pred_instances.bboxes.cpu().numpy()
                    scores = pred_instances.scores.cpu().numpy()

                    for label, bbox, score in zip(labels, bboxes, scores):
                        if score >= score_threshold:
                            x1, y1, x2, y2 = map(int, bbox[:4])
                            if x2 > x1 and y2 > y1:
                                if label == self.wall_class_id:
                                    wall_bboxes.append([x1, y1, x2, y2])
                                elif label == self.room_class_id:
                                    room_bboxes.append([x1, y1, x2, y2])
            elif isinstance(result, (list, tuple)):
                if len(result) > 0 and isinstance(result[0], DetDataSample):
                    for res in result:
                        pred_instances = res.pred_instances
                        if pred_instances is not None:
                            labels = pred_instances.labels.cpu().numpy()
                            bboxes = pred_instances.bboxes.cpu().numpy()
                            scores = pred_instances.scores.cpu().numpy()

                            for label, bbox, score in zip(labels, bboxes, scores):
                                if score >= score_threshold:
                                    x1, y1, x2, y2 = map(int, bbox[:4])
                                    if x2 > x1 and y2 > y1:
                                        if label == self.wall_class_id:
                                            wall_bboxes.append([x1, y1, x2, y2])
                                        elif label == self.room_class_id:
                                            room_bboxes.append([x1, y1, x2, y2])
                elif len(result) >= 2:
                    wall_detections = result[self.wall_class_id] if len(result) > self.wall_class_id else np.array([])
                    room_detections = result[self.room_class_id] if len(result) > self.room_class_id else np.array([])

                    if isinstance(wall_detections, np.ndarray) and wall_detections.shape[0] > 0:
                        for det in wall_detections:
                            if len(det) >= 5 and det[4] >= score_threshold:
                                x1, y1, x2, y2 = map(int, det[:4])
                                if x2 > x1 and y2 > y1:
                                    wall_bboxes.append([x1, y1, x2, y2])

                    if isinstance(room_detections, np.ndarray) and room_detections.shape[0] > 0:
                        for det in room_detections:
                            if len(det) >= 5 and det[4] >= score_threshold:
                                x1, y1, x2, y2 = map(int, det[:4])
                                if x2 > x1 and y2 > y1:
                                    room_bboxes.append([x1, y1, x2, y2])

            logger.info(f"Найдено стен: {len(wall_bboxes)}, комнат: {len(room_bboxes)}")
            return {
                'wall_bboxes': wall_bboxes,
                'room_bboxes': room_bboxes
            }
        except Exception as e:
            logger.error(f"Ошибка детекции: {e}")
            return None


# from ml_service.modeling.bbox_detector import BBoxDetector
# # Запуск
# if __name__ == "__main__":
#     detector = BBoxDetector()
#     # примеры
#     # result = detector.detect(Path(""))
