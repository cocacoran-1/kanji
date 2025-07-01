import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import './App.css';

interface Kanji {
  id: number;
  kanji: string;
  level: string; // 레벨 필드가 중요해집니다.
  korean_meaning: string;
  onyomi: string[];
  kunyomi: string[];
  strokes: number;
  words?: object[];
  example_sentences?: object[];
}

interface Word {
  word: string;
  reading: string;
  meaning: string;
}

interface ExampleSentence {
  sentence: string;
  reading: string;
  translation: string;
}

// 레벨별로 그룹화된 한자 데이터의 타입
type GroupedKanji = {
  [level: string]: Kanji[];
};

function App() {
  const [kanjiList, setKanjiList] = useState<Kanji[]>([]);
  const [selectedKanji, setSelectedKanji] = useState<Kanji | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // 새로운 상태 변수들
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  useEffect(() => {
    const fetchKanjiList = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get('http://localhost:3001/api/kanji');
        setKanjiList(response.data);
        // 기본으로 첫 번째 레벨을 선택
        if (response.data.length > 0) {
            const firstLevel = response.data[0].level;
            setSelectedLevel(firstLevel);
            setSelectedKanji(response.data.find(k => k.level === firstLevel) || null);
        }
      } catch (err) {
        console.error("Error fetching kanji list:", err);
        setError('한자 목록을 불러오는 데 실패했습니다. 백엔드 서버를 확인해주세요.');
      } finally {
        setLoading(false);
      }
    };
    fetchKanjiList();
  }, []);

  // 레벨별로 한자 데이터를 그룹화 (useMemo로 성능 최적화)
  const groupedKanji = useMemo((): GroupedKanji => {
    return kanjiList.reduce((acc, kanji) => {
      const { level } = kanji;
      if (!acc[level]) {
        acc[level] = [];
      }
      acc[level].push(kanji);
      return acc;
    }, {} as GroupedKanji);
  }, [kanjiList]);

  const levels = Object.keys(groupedKanji);

  const handleLevelClick = (level: string) => {
    setSelectedLevel(level);
    const firstKanjiOfLevel = groupedKanji[level]?.[0];
    if (firstKanjiOfLevel) {
        setSelectedKanji(firstKanjiOfLevel);
        setCurrentIndex(0);
    }
  };

  // 다음/이전 한자로 이동하는 함수
  const navigateKanji = useCallback((direction: 'next' | 'prev') => {
    if (!selectedLevel || !groupedKanji[selectedLevel]) return;

    const levelKanji = groupedKanji[selectedLevel];
    let nextIndex = currentIndex;

    if (direction === 'next') {
        nextIndex = (currentIndex + 1) % levelKanji.length;
    } else {
        nextIndex = (currentIndex - 1 + levelKanji.length) % levelKanji.length;
    }

    setCurrentIndex(nextIndex);
    setSelectedKanji(levelKanji[nextIndex]);
  }, [currentIndex, selectedLevel, groupedKanji]);


  // 키보드 이벤트 핸들러 (스페이스바, 화살표 키)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space' || e.key === 'ArrowRight') {
            e.preventDefault(); // 스페이스바의 기본 스크롤 동작 방지
            navigateKanji('next');
        } else if (e.key === 'ArrowLeft') {
            navigateKanji('prev');
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
        window.removeEventListener('keydown', handleKeyDown);
    };
  }, [navigateKanji]);


  if (loading) {
    return <div className="App-container"><h1>한자 학습 사이트</h1><p className="status-message">데이터를 불러오는 중입니다...</p></div>;
  }

  if (error && kanjiList.length === 0) {
     return <div className="App-container"><h1>한자 학습 사이트</h1><p className="error-message">{error}</p></div>;
  }

  return (
    <div className="App-container">
      <header className="App-header">
        <h1>한자 학습 사이트</h1>
      </header>

      <div className="content-layout">
        <aside className="sidebar">
          <h2>JLPT 레벨</h2>
          <ul className="level-list">
            {levels.map((level) => (
              <li
                key={level}
                onClick={() => handleLevelClick(level)}
                className={selectedLevel === level ? 'selected' : ''}
              >
                {level}
              </li>
            ))}
          </ul>
        </aside>

        <main className="main-content">
          {selectedKanji ? (
            <div className="kanji-details-container">
                <div className="navigation-arrow prev" onClick={() => navigateKanji('prev')}>
                    &#10094;
                </div>
                <div className="kanji-details">
                    <h2 className="kanji-character">{selectedKanji.kanji}</h2>
                    <p><strong>한국어 뜻:</strong> {selectedKanji.korean_meaning}</p>
                    <p><strong>음독(Onyomi):</strong> {selectedKanji.onyomi.join(', ')}</p>
                    <p><strong>훈독(Kunyomi):</strong> {selectedKanji.kunyomi.join(', ')}</p>
                    <p><strong>획수:</strong> {selectedKanji.strokes}</p>

                    <div className="detail-section">
                        <h3>관련 단어 (Words)</h3>
                        {selectedKanji.words && (selectedKanji.words as Word[]).map((word, index) => (
                            <div key={index} className="word-entry">
                            <span className="word-jp">{word.word}</span> ({word.reading})
                            <span className="word-meaning">: {word.meaning}</span>
                            </div>
                        ))}
                    </div>

                    <div className="detail-section">
                        <h3>예문 (Example Sentences)</h3>
                        {selectedKanji.example_sentences && (selectedKanji.example_sentences as ExampleSentence[]).map((ex, index) => (
                            <div key={index} className="example-entry">
                            <p className="ex-sentence">{ex.sentence}</p>
                            <p className="ex-reading">({ex.reading})</p>
                            <p className="ex-translation">→ {ex.translation}</p>
                            </div>
                        ))}
                    </div>
                </div>
                <div className="navigation-arrow next" onClick={() => navigateKanji('next')}>
                    &#10095;
                </div>
            </div>
          ) : (
            <p className="placeholder-text">왼쪽에서 학습할 레벨을 선택해주세요.</p>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
