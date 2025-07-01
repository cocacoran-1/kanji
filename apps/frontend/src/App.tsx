import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import './App.css';

// 변경된 데이터 구조에 맞춘 인터페이스
interface Kanji {
  id: number;
  kanji: string;
  level: string;
  korean_meaning: string;       // 뜻
  korean_pronunciation: string; // 음
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

type GroupedKanji = {
  [level: string]: Kanji[];
};

function App() {
  const [kanjiList, setKanjiList] = useState<Kanji[]>([]);
  const [selectedKanji, setSelectedKanji] = useState<Kanji | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  useEffect(() => {
    const fetchKanjiList = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get('http://localhost:3001/api/kanji');
        setKanjiList(response.data);
        if (response.data.length > 0) {
            const firstLevel = response.data[0].level;
            setSelectedLevel(firstLevel);
            setSelectedKanji(response.data.find(k => k.level === firstLevel) || null);
        }
      } catch (err) {
        console.error("Error fetching kanji list:", err);
        setError('한자 목록을 불러오는 데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };
    fetchKanjiList();
  }, []);

  const groupedKanji = useMemo((): GroupedKanji => {
    return kanjiList.reduce((acc, kanji) => {
      const { level } = kanji;
      if (!acc[level]) acc[level] = [];
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

  const navigateKanji = useCallback((direction: 'next' | 'prev') => {
    if (!selectedLevel || !groupedKanji[selectedLevel]) return;
    const levelKanji = groupedKanji[selectedLevel];
    let nextIndex = (direction === 'next')
      ? (currentIndex + 1) % levelKanji.length
      : (currentIndex - 1 + levelKanji.length) % levelKanji.length;
    setCurrentIndex(nextIndex);
    setSelectedKanji(levelKanji[nextIndex]);
  }, [currentIndex, selectedLevel, groupedKanji]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'Space' || e.key === 'ArrowRight') {
            e.preventDefault();
            navigateKanji('next');
        } else if (e.key === 'ArrowLeft') {
            navigateKanji('prev');
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [navigateKanji]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="App-container">
      <header className="App-header">
        <h1>한자 학습 사이트</h1>
      </header>
      <div className="content-layout">
        <aside className="sidebar">
          <h2>JLPT 레벨</h2>
          <ul className="level-list">
            {levels.map(level => (
              <li key={level} onClick={() => handleLevelClick(level)} className={selectedLevel === level ? 'selected' : ''}>
                {level}
              </li>
            ))}
          </ul>
        </aside>
        <main className="main-content">
          {selectedKanji ? (
            <div className="kanji-details-container">
                <div className="navigation-arrow prev" onClick={() => navigateKanji('prev')}>&#10094;</div>
                <div className="kanji-details">
                  {/* --- 상단 정보 패널 --- */}
                  <div className="panel info-panel">
                    <div className="info-kanji-char">{selectedKanji.kanji}</div>
                    <div className="info-details-grid">
                      <div><strong>뜻:</strong> {selectedKanji.korean_meaning}</div>
                      <div><strong>음독:</strong> {selectedKanji.onyomi.join(', ')}</div>
                      <div><strong>음:</strong> {selectedKanji.korean_pronunciation}</div>
                      <div><strong>훈독:</strong> {selectedKanji.kunyomi.join(', ')}</div>
                    </div>
                  </div>

                  {/* --- 관련 단어 패널 --- */}
                  <div className="panel words-panel">
                    <h3 className="panel-title">관련 단어</h3>
                    <div className="panel-content">
                      {selectedKanji.words && (selectedKanji.words as Word[]).map((word, index) => (
                        <div key={index} className="word-entry">
                          <span className="word-jp">{word.word}</span> ({word.reading}): <span className="word-meaning">{word.meaning}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* --- 예문 패널 --- */}
                  <div className="panel sentences-panel">
                    <h3 className="panel-title">예문</h3>
                    <div className="panel-content">
                      {selectedKanji.example_sentences && (selectedKanji.example_sentences as ExampleSentence[]).map((ex, index) => (
                        <div key={index} className="example-entry">
                          <p className="ex-sentence">{ex.sentence}</p>
                          <p className="ex-reading">({ex.reading})</p>
                          <p className="ex-translation">→ {ex.translation}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="navigation-arrow next" onClick={() => navigateKanji('next')}>&#10095;</div>
            </div>
          ) : (
            <p className="placeholder-text">학습할 레벨을 선택해주세요.</p>
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
