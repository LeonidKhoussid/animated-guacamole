import os
import re
import logging
from pathlib import Path
from config import NLPConfig
from typing import Optional, Dict, List


logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)
if not logger.handlers:
    h = logging.StreamHandler()
    h.setFormatter(logging.Formatter("%(asctime)s %(levelname)s %(message)s"))
    logger.addHandler(h)


nlp_cfg = NLPConfig()

try:
    from deep_translator import GoogleTranslator
    TRANSLATOR_AVAILABLE = True
except ImportError:
    TRANSLATOR_AVAILABLE = False

try:
    import nltk
    from nltk.tokenize import word_tokenize
    from nltk.corpus import stopwords
    from nltk.tag import pos_tag
    NLTK_AVAILABLE = True
    os.environ["NLTK_DATA"] = str(Path(nlp_cfg.nltk_data_dir).absolute())
    nltk.data.path.insert(0, str(Path(nlp_cfg.nltk_data_dir).absolute()))
    for pkg in ["punkt", "averaged_perceptron_tagger", "stopwords"]:
        try:
            nltk.data.find(f"tokenizers/{pkg}")
        except LookupError:
            nltk.download(pkg, download_dir=nlp_cfg.nltk_data_dir, quiet=True)
except ImportError:
    NLTK_AVAILABLE = False

def _load_spacy(model: str, folder: str) -> Optional:
    try:
        import spacy
    except ImportError:
        return None
    p = Path(folder)
    if p.exists() and any(p.iterdir()):
        try:
            return spacy.load(str(p))
        except Exception:
            pass
    try:
        nlp = spacy.load(model)
        p.mkdir(parents=True, exist_ok=True)
        nlp.to_disk(str(p))
        return nlp
    except Exception:
        return None


try:
    import spacy
    SPACY_AVAILABLE = True
    nlp_en = _load_spacy(nlp_cfg.spacy_model_en, nlp_cfg.spacy_en_model_dir)
except ImportError:
    SPACY_AVAILABLE = False
    nlp_en = None


class PromptGenerator:
    """СТРУКТУРНЫЕ ПРОМПТЫ [Rus->Eng]"""

    # Генерация
    def generate_prompt(self, text: str, translate: bool = True, extract_entities: bool = True) -> str:
        if not text or not text.strip():
            return ""
        src = text.strip()
        if extract_entities:
            ents = self._extract_entities(src)
            if ents:
                st = self._build_structured(ents)
                if st:
                    text = st
                else:
                    text = self._maybe_translate(src, translate)
            else:
                text = self._maybe_translate(src, translate)
        else:
            text = self._maybe_translate(src, translate)
        return self._format_prompt(text)

    # Перевод
    def _maybe_translate(self, text: str, flag: bool) -> str:
        if not flag or not TRANSLATOR_AVAILABLE:
            return text
        try:
            tr = GoogleTranslator(source="ru", target="en")
            return tr.translate(text)
        except Exception:
            return text

    # Извлечение
    def _extract_entities(self, text: str) -> Dict[str, List[str]]:
        d = {"nouns": [], "adjectives": [], "named_entities": []}
        if self._detect_ru(text) and TRANSLATOR_AVAILABLE:
            try:
                tr = GoogleTranslator(source="ru", target="en")
                text = tr.translate(text)
            except Exception:
                pass
        if SPACY_AVAILABLE and nlp_en:
            x = self._spacy(text)
            d["named_entities"] += x["named_entities"]
            d["nouns"] += x["nouns"]
            d["adjectives"] += x["adjectives"]
        if NLTK_AVAILABLE:
            x = self._nltk(text)
            d["nouns"] += x["nouns"]
            d["adjectives"] += x["adjectives"]
        for k in d:
            d[k] = list({e.lower() for e in d[k] if len(e) > 2})
        return d

    # Язык
    def _detect_ru(self, t: str) -> bool:
        return sum(1 for c in t if "\u0400" <= c <= "\u04FF") > len(t) * 0.3

    # spaCy
    def _spacy(self, t: str) -> Dict[str, List[str]]:
        out = {"named_entities": [], "nouns": [], "adjectives": []}
        try:
            doc = nlp_en(t)
            for e in doc.ents:
                if e.label_ in ["PERSON", "ORG", "GPE", "PRODUCT", "EVENT", "WORK_OF_ART"]:
                    out["named_entities"].append(e.text)
            for tok in doc:
                if tok.pos_ == "NOUN" and not tok.is_stop and len(tok.text) > 2:
                    out["nouns"].append(tok.text)
                elif tok.pos_ == "ADJ" and not tok.is_stop and len(tok.text) > 2:
                    out["adjectives"].append(tok.text)
        except Exception:
            pass
        return out

    # NLTK
    def _nltk(self, t: str) -> Dict[str, List[str]]:
        out = {"nouns": [], "adjectives": []}
        try:
            toks = word_tokenize(t.lower())
            tags = pos_tag(toks)
            try:
                sw = set(stopwords.words("english"))
            except LookupError:
                sw = set()
            for w, pos in tags:
                if w.isalpha() and w not in sw and len(w) > 2:
                    if pos.startswith("NN"):
                        out["nouns"].append(w)
                    elif pos.startswith("JJ"):
                        out["adjectives"].append(w)
        except Exception:
            pass
        return out

    # Структура
    def _build_structured(self, ents: Dict[str, List[str]]) -> str:
        r, s = [], set()
        for c in ["named_entities", "nouns", "adjectives"]:
            for t in ents.get(c, []):
                if t not in s:
                    r.append(t)
                    s.add(t)
        return ", ".join(r) if r else ""

    # Форматирование
    def _format_prompt(self, p: str) -> str:
        w = re.findall(r"\b\w+\b", p.lower())
        out, s = [], set()
        for x in w:
            if len(x) > 2 and x not in s:
                out.append(x)
                s.add(x)
        return ", ".join(out) if out else p


# from ml_service.utils.prompt_generator import PromptGenerator
# # Запуск
# if __name__ == "__main__":
#     gen = PromptGenerator()
#     text = gen.generate_prompt("Светлая спаяльня в современном стиле с большой кровтью
#     с синим одеялом и двумя тумбочками по бокам.")
