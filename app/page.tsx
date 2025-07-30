/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Check, X, RotateCcw, Download } from 'lucide-react';
import * as d3 from 'd3';

// 型定義
interface FlavorItem {
  category: string;
  subcategory: string;
  flavor: string;
}

interface Submission {
  id: number;
  name: string;
  age: number;
  flavors: FlavorItem[];
  timestamp: string;
  rawTimestamp: string;
}

interface FlavorData {
  [category: string]: {
    [subcategory: string]: string[];
  };
}

interface HierarchyNode {
  name: string;
  value?: number;
  children?: HierarchyNode[];
}

type D3HierarchyNode = any;

export default function CoffeeFlavorWheel() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [flavorData, setFlavorData] = useState<FlavorData>({});
  const [selectedFlavors, setSelectedFlavors] = useState<string[]>([]);
  const [participantName, setParticipantName] = useState<string>('');
  const [participantAge, setParticipantAge] = useState<string>('');
  const [showSubmitForm, setShowSubmitForm] = useState<boolean>(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // 既存のアンケート結果を読み込み
  useEffect(() => {
    const loadSubmissions = async () => {
      try {
        const response = await fetch('/api/surveys');
        const result = await response.json();
        if (result.success) {
          setSubmissions(result.data);
        }
      } catch (error) {
        console.error('Failed to load submissions:', error);
      }
    };

    loadSubmissions();
  }, []);

  // CSVデータまたはフォールバックデータを読み込み
  useEffect(() => {
    const loadFlavorData = async () => {
      try {
        // Next.jsの場合、public フォルダに CSV を配置
        const response = await fetch('/coffeeflavorwheel.csv');
        const csvContent = await response.text();
        
        const lines = csvContent.split('\n');
        const data: FlavorData = {};
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',');
          if (values.length >= 3) {
            const level1 = values[0]?.trim();
            const level2 = values[1]?.trim();
            const level3 = values[2]?.trim();
            
            if (level1 && level2 && level3) {
              if (!data[level1]) data[level1] = {};
              if (!data[level1][level2]) data[level1][level2] = [];
              if (!data[level1][level2].includes(level3)) {
                data[level1][level2].push(level3);
              }
            }
          }
        }
        
        setFlavorData(data);
      } catch (error) {
        console.error('CSV読み込みエラー:', error);
        // フォールバックデータを使用
        setFlavorData({
          FRUITS: {
            CITRUS: ['LEMON', 'LIME', 'GRAPEFRUIT', 'ORANGE'],
            'STONE FRUIT': ['PEACH', 'APRICOT', 'PLUM'],
            BERRY: ['STRAWBERRY', 'RASPBERRY', 'BLUEBERRY', 'BLACKBERRY'],
            TROPICAL: ['MANGO', 'PINEAPPLE', 'BANANA', 'COCONUT'],
            POME: ['APPLE', 'PEAR']
          },
          SPICES: {
            SWEET: ['CINNAMON', 'VANILLA', 'NUTMEG', 'CLOVE'],
            HOT: ['CHILI', 'PEPPER', 'GINGER', 'WASABI'],
            AROMATIC: ['BASIL', 'OREGANO', 'THYME', 'ROSEMARY']
          },
          NUTS: {
            'TREE NUTS': ['ALMOND', 'WALNUT', 'CASHEW', 'PECAN'],
            LEGUMES: ['PEANUT', 'SOYBEAN'],
            SEEDS: ['SUNFLOWER', 'PUMPKIN']
          },
          VEGETABLES: {
            'LEAFY GREENS': ['LETTUCE', 'SPINACH', 'KALE', 'ARUGULA'],
            ROOT: ['CARROT', 'POTATO', 'BEET', 'RADISH'],
            CRUCIFEROUS: ['BROCCOLI', 'CAULIFLOWER', 'CABBAGE']
          },
          GRAINS: {
            WHEAT: ['FLOUR', 'BREAD', 'PASTA'],
            RICE: ['WHITE RICE', 'BROWN RICE', 'WILD RICE'],
            ANCIENT: ['QUINOA', 'BARLEY', 'OATS']
          }
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadFlavorData();
  }, []);

  // サンバースト図を作成
  useEffect(() => {
    if (Object.keys(flavorData).length === 0 || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = 1000;
    const height = 1000;
    const radius = Math.min(width, height) / 2 - 30;

    const g = svg
      .attr("width", width)
      .attr("height", height)
      .append("g")
      .attr("transform", `translate(${width / 2},${height / 2})`);

    // 階層データを構築
    const hierarchyData: HierarchyNode = {
      name: "Coffee Flavors",
      children: Object.entries(flavorData).map(([category, subcategories]) => ({
        name: category,
        children: Object.entries(subcategories).map(([subcategory, flavors]) => ({
          name: subcategory,
          children: flavors.map(flavor => ({
            name: flavor,
            value: 1
          }))
        }))
      }))
    };

    const root = d3.hierarchy(hierarchyData)
      .sum((d: D3HierarchyNode) => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));

    const partition = d3.partition<HierarchyNode>()
      .size([2 * Math.PI, radius]);

    partition(root);

    // カラーパレット
    const colorScale = d3.scaleOrdinal<string>()
      .domain(Object.keys(flavorData))
      .range([
        '#ef4444', // FRUITS - red
        '#22c55e', // VEGETABLES - green  
        '#f97316', // SPICES - orange
        '#eab308', // GRAINS - yellow
        '#3b82f6', // DAIRY - blue
        '#8b5cf6', // PROTEIN - purple
        '#f59e0b'  // NUTS - amber
      ]);

    const arc = d3.arc<d3.HierarchyRectangularNode<HierarchyNode>>()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .innerRadius(d => d.y0)
      .outerRadius(d => d.y1);

    // パスを描画
    g.selectAll("path")
      .data(root.descendants().filter(d => d.depth > 0))
      .enter()
      .append("path")
      .attr("d", arc)
      .style("fill", (d: D3HierarchyNode) => {
        if (d.depth === 1) {
          return colorScale(d.data.name);
        } else if (d.depth === 2) {
          const parentColor = colorScale(d.parent.data.name);
          return d3.color(parentColor)?.brighter(0.3)?.toString() || parentColor;
        } else {
          const grandParentColor = colorScale(d.parent.parent.data.name);
          return d3.color(grandParentColor)?.brighter(0.6)?.toString() || grandParentColor;
        }
      })
      .style("stroke", "#fff")
      .style("stroke-width", 2)
      .style("cursor", "pointer")
      .style("opacity", (d: D3HierarchyNode) => {
        if (d.depth === 3) { // 最内層（フレーバー）のみクリック可能
          const flavorId = `${d.parent.parent.data.name}-${d.parent.data.name}-${d.data.name}`;
          return selectedFlavors.includes(flavorId) ? 1 : 0.8;
        }
        return 0.7;
      })
      .on("mouseover", function(event, d: D3HierarchyNode) {
        if (d.depth === 3) {
          d3.select(this)
            .style("opacity", 1)
            .style("stroke-width", 3);
        }
      })
      .on("mouseout", function(event, d: D3HierarchyNode) {
        if (d.depth === 3) {
          const flavorId = `${d.parent.parent.data.name}-${d.parent.data.name}-${d.data.name}`;
          d3.select(this)
            .style("opacity", selectedFlavors.includes(flavorId) ? 1 : 0.8)
            .style("stroke-width", 2);
        }
      })
      .on("click", function(event, d: D3HierarchyNode) {
        if (d.depth === 3) { // 最内層（フレーバー）のみクリック可能
          const flavorId = `${d.parent.parent.data.name}-${d.parent.data.name}-${d.data.name}`;
          toggleFlavor(d.parent.parent.data.name, d.parent.data.name, d.data.name);
          
          d3.select(this)
            .transition()
            .duration(200)
            .style("transform", selectedFlavors.includes(flavorId) ? "scale(0.95)" : "scale(1.05)")
            .transition()
            .duration(200)
            .style("transform", "scale(1)");
        }
      });

    // ラベルを追加（全階層対応）
    g.selectAll("text")
      .data(root.descendants().filter(d => d.depth > 0))
      .enter()
      .append("text")
      .attr("transform", (d: D3HierarchyNode) => {
        const angle = (d.x0 + d.x1) / 2;
        const radius = (d.y0 + d.y1) / 2;
        const x = Math.cos(angle - Math.PI / 2) * radius;
        const y = Math.sin(angle - Math.PI / 2) * radius;
        const rotation = angle * 180 / Math.PI - 90;
        // テキストの回転を調整して読みやすくする
        const adjustedRotation = rotation > 90 && rotation < 270 ? rotation + 180 : rotation;
        return `translate(${x},${y}) rotate(${adjustedRotation})`;
      })
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .style("font-size", (d: D3HierarchyNode) => {
        if (d.depth === 1) return "18px";        // カテゴリ（大きく）
        if (d.depth === 2) return "16px";        // サブカテゴリ（中程度）  
        return "14px";                           // フレーバー（読みやすく）
      })
      .style("font-weight", (d: D3HierarchyNode) => d.depth === 1 ? "bold" : "600")
      .style("fill", (d: D3HierarchyNode) => {
        if (d.depth === 1) return "#ffffff";     // カテゴリ：白
        if (d.depth === 2) return "#ffffff";     // サブカテゴリ：白
        return "#1f2937";                        // フレーバー：濃いグレー
      })
      .style("text-shadow", (d: D3HierarchyNode) => {
        if (d.depth === 1) return "3px 3px 6px rgba(0,0,0,0.9), 1px 1px 2px rgba(0,0,0,0.8)";  // カテゴリ：二重影
        if (d.depth === 2) return "2px 2px 4px rgba(0,0,0,0.8), 1px 1px 2px rgba(0,0,0,0.7)";  // サブカテゴリ：二重影
        return "2px 2px 4px rgba(255,255,255,0.9), 1px 1px 2px rgba(255,255,255,0.8)";          // フレーバー：二重白影
      })
      .style("pointer-events", "none")
      .style("opacity", (d: D3HierarchyNode) => {
        // 角度の幅が小さすぎる場合はテキストを非表示
        const angleWidth = d.x1 - d.x0;
        if (d.depth === 1 && angleWidth < 0.2) return 0;   // カテゴリが狭すぎる場合
        if (d.depth === 2 && angleWidth < 0.08) return 0;  // サブカテゴリが狭すぎる場合  
        if (d.depth === 3 && angleWidth < 0.03) return 0;  // フレーバーが狭すぎる場合
        return 1;
      })
      .text((d: D3HierarchyNode) => {
        const angleWidth = d.x1 - d.x0;
        let maxLength;
        
        if (d.depth === 1) {
          maxLength = angleWidth > 0.4 ? 30 : 20;   // カテゴリ
        } else if (d.depth === 2) {
          maxLength = angleWidth > 0.2 ? 25 : 15;   // サブカテゴリ
        } else {
          maxLength = angleWidth > 0.08 ? 20 : 12;   // フレーバー
        }
        
        // 日本語の場合は文字数ではなく、実際の表示幅を考慮
        const name = d.data.name;
        if (name.length <= maxLength) {
          return name;
        }
        
        // 日本語の長い単語の場合は、より多くの文字を表示
        const japaneseRatio = (name.match(/[あ-んア-ン]/g) || []).length / name.length;
        if (japaneseRatio > 0.5) {
          // 日本語が多い場合は、より多くの文字を表示
          const adjustedMaxLength = Math.floor(maxLength * 1.5);
          return name.length > adjustedMaxLength 
            ? name.substring(0, adjustedMaxLength) + "..."
            : name;
        }
        
        return name.length > maxLength 
          ? name.substring(0, maxLength) + "..."
          : name;
      });

    // 中央にタイトル
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .style("font-size", "18px")
      .style("font-weight", "bold")
      .style("fill", "#374151")
      .text("COFFEE");
    
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("dy", "1.2em")
      .style("font-size", "14px")
      .style("fill", "#6b7280")
      .text("FLAVORS");

  }, [flavorData, selectedFlavors]);

  const toggleFlavor = (category: string, subcategory: string, flavor: string) => {
    const flavorId = `${category}-${subcategory}-${flavor}`;
    
    setSelectedFlavors(prev => {
      if (prev.includes(flavorId)) {
        return prev.filter(id => id !== flavorId);
      } else {
        return [...prev, flavorId];
      }
    });
  };

  const clearSelections = () => {
    setSelectedFlavors([]);
    setParticipantName('');
    setParticipantAge('');
    setShowSubmitForm(false);
  };

  const submitSurvey = async () => {
    if (participantName.trim() && participantAge.trim() && selectedFlavors.length > 0) {
      const age = parseInt(participantAge);
      if (isNaN(age) || age < 1 || age > 120) {
        alert('正しい年齢を入力してください（1-120歳）');
        return;
      }

      try {
        const flavorsData = selectedFlavors.map(id => {
          const [category, subcategory, flavor] = id.split('-');
          return { category, subcategory, flavor };
        });

        // サーバーに送信
        const response = await fetch('/api/surveys', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: participantName.trim(),
            age: age,
            flavors: flavorsData
          })
        });

        const result = await response.json();

        if (result.success) {
          // ローカル状態を更新
          setSubmissions(prev => [result.data, ...prev]);
          clearSelections();
          alert('アンケートを送信しました！ありがとうございます。');
        } else {
          alert('送信に失敗しました。もう一度お試しください。');
        }
      } catch (error) {
        console.error('Submit error:', error);
        alert('送信中にエラーが発生しました。');
      }
    }
  };

  const downloadResults = () => {
    const csvContent = [
      'ID,名前,年齢,タイムスタンプ,選択したフレーバー数,フレーバー詳細',
      ...submissions.map(sub => 
        `${sub.id},"${sub.name}",${sub.age},"${sub.timestamp}",${sub.flavors.length},"${sub.flavors.map(f => `${f.category}&gt;${f.subcategory}&gt;${f.flavor}`).join('; ')}"`
      )
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `coffee-flavor-survey-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p className="text-amber-800">フレーバーホイールを読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-amber-900 mb-2">☕ コーヒーフレーバーホイール</h1>
          <p className="text-amber-700 text-lg">外側のフレーバーをクリックして選択してください</p>
          {selectedFlavors.length > 0 && (
            <div className="mt-4 p-3 bg-white rounded-lg shadow-md">
              <p className="text-sm text-gray-600 mb-2">選択中: {selectedFlavors.length}個のフレーバー</p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => setShowSubmitForm(true)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                >
                  <Check size={16} />
                  アンケート送信
                </button>
                <button
                  onClick={clearSelections}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
                >
                  <RotateCcw size={16} />
                  リセット
                </button>
              </div>
            </div>
          )}
        </div>

        {/* サンバースト図 */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-xl shadow-2xl p-8">
            <svg ref={svgRef}></svg>
          </div>
        </div>

        {/* 選択したフレーバーの表示 */}
        {selectedFlavors.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6 mb-8">
            <h3 className="text-xl font-bold mb-4 text-center">選択したフレーバー</h3>
            <div className="flex flex-wrap gap-2 justify-center">
              {selectedFlavors.map(id => {
                const [category, , flavor] = id.split('-');
                return (
                  <div key={id} className="bg-amber-100 border border-amber-300 px-3 py-2 rounded-full text-sm">
                    <span className="font-medium text-amber-800">{flavor}</span>
                    <span className="text-amber-600 text-xs ml-1">({category})</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 送信フォームモーダル */}
        {showSubmitForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl p-6 max-w-md w-full">
              <h3 className="text-xl font-bold mb-4 text-center">アンケート送信</h3>
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">選択したフレーバー: {selectedFlavors.length}個</p>
                <div className="max-h-32 overflow-y-auto bg-gray-50 p-2 rounded text-xs">
                  {selectedFlavors.map(id => {
                    const [category, subcategory, flavor] = id.split('-');
                    return (
                      <div key={id} className="mb-1">
                        {category} &gt; {subcategory} &gt; {flavor}
                      </div>
                    );
                  })}
                </div>
              </div>
              <input
                type="text"
                placeholder="お名前を入力してください"
                value={participantName}
                onChange={(e) => setParticipantName(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <input
                type="number"
                placeholder="年齢を入力してください"
                value={participantAge}
                onChange={(e) => setParticipantAge(e.target.value)}
                min="1"
                max="120"
                className="w-full p-3 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={submitSurvey}
                  disabled={!participantName.trim() || !participantAge.trim() || selectedFlavors.length === 0}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                >
                  送信
                </button>
                <button
                  onClick={() => setShowSubmitForm(false)}
                  className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
                >
                  <X size={16} />
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 結果表示 */}
        {submissions.length > 0 && (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-bold">アンケート結果 ({submissions.length}件)</h3>
              <button
                onClick={downloadResults}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Download size={16} />
                CSV出力
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">名前</th>
                    <th className="text-left p-2">年齢</th>
                    <th className="text-left p-2">時間</th>
                    <th className="text-left p-2">フレーバー数</th>
                    <th className="text-left p-2">選択したフレーバー</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.slice(-10).reverse().map(submission => (
                    <tr key={submission.id} className="border-b hover:bg-gray-50">
                      <td className="p-2 font-medium">{submission.name}</td>
                      <td className="p-2">{submission.age}歳</td>
                      <td className="p-2 text-gray-600">{submission.timestamp}</td>
                      <td className="p-2">{submission.flavors.length}個</td>
                      <td className="p-2">
                        <div className="max-w-xs overflow-hidden">
                          {submission.flavors.slice(0, 3).map((flavor, idx) => (
                            <span key={idx} className="inline-block bg-gray-100 px-2 py-1 rounded text-xs mr-1 mb-1">
                              {flavor.flavor}
                            </span>
                          ))}
                          {submission.flavors.length > 3 && (
                            <span className="text-gray-500 text-xs">...他{submission.flavors.length - 3}個</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
