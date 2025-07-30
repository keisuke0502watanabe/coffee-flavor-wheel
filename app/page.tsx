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
  coffeeName: string;
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

type D3HierarchyNode = d3.HierarchyRectangularNode<HierarchyNode>;

export default function CoffeeFlavorWheel() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [flavorData, setFlavorData] = useState<FlavorData>({});
  const [selectedFlavors, setSelectedFlavors] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<string[]>([]); // カテゴリ、サブカテゴリ、フレーバー全て
  const [participantName, setParticipantName] = useState<string>('');
  const [participantAge, setParticipantAge] = useState<string>('');
  const [coffeeName, setCoffeeName] = useState<string>('');
  const [showSubmitForm, setShowSubmitForm] = useState<boolean>(false);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

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

  // ウィンドウリサイズのハンドリング
  useEffect(() => {
    const handleResize = () => {
      // 少し遅延させて、リサイズが完了してから再描画
      setTimeout(() => {
        if (Object.keys(flavorData).length > 0 && svgRef.current) {
          // 強制的に再描画をトリガー
          setSelectedFlavors(prev => [...prev]);
        }
      }, 100);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [flavorData]);

  // サンバースト図を作成
  useEffect(() => {
    if (Object.keys(flavorData).length === 0 || !svgRef.current) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    // 画面サイズに応じてSVGサイズを調整
    const containerElement = svgRef.current?.parentElement;
    const containerWidth = containerElement?.clientWidth || 600;
    const containerHeight = window.innerHeight;
    const screenWidth = window.innerWidth;
    
    // PCブラウザではより大きな円を表示
    const isMobile = screenWidth < 768;
    
    // 最小サイズを設定して、拡大時に小さくなりすぎないようにする
    const minSize = isMobile ? 300 : 400;
    const maxSize = isMobile ? 800 : 1200;
    const heightRatio = isMobile ? 0.6 : 0.8;
    
    // 利用可能なサイズを計算
    const availableHeight = containerHeight * heightRatio;
    const availableWidth = Math.max(containerWidth, minSize); // 最小幅を保証
    
    // サイズを決定（最小サイズを下回らないようにする）
    let size = Math.min(availableWidth, availableHeight, maxSize);
    size = Math.max(size, minSize); // 最小サイズを保証
    
    const width = size;
    const height = size;
    const radius = Math.min(width, height) / 2 - 20;

    // デバッグ情報（開発時のみ）
    if (process.env.NODE_ENV === 'development') {
      console.log('SVG Size Calculation:', {
        containerWidth,
        containerHeight,
        screenWidth,
        isMobile,
        minSize,
        maxSize,
        availableHeight,
        availableWidth,
        finalSize: size,
        radius
      });
    }

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
      .startAngle((d: d3.HierarchyRectangularNode<HierarchyNode>) => d.x0)
      .endAngle((d: d3.HierarchyRectangularNode<HierarchyNode>) => d.x1)
      .innerRadius((d: d3.HierarchyRectangularNode<HierarchyNode>) => d.y0)
      .outerRadius((d: d3.HierarchyRectangularNode<HierarchyNode>) => d.y1);

    // パスを描画
    g.selectAll("path")
      .data(root.descendants().filter(d => d.depth > 0))
      .enter()
      .append("path")
      .attr("d", (d: d3.HierarchyRectangularNode<HierarchyNode>) => arc(d))
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
        let itemId: string;
        let isSelected = false;
        
        if (d.depth === 1) {
          itemId = `category-${d.data.name}`;
          isSelected = selectedItems.includes(itemId);
        } else if (d.depth === 2) {
          itemId = `subcategory-${d.parent.data.name}-${d.data.name}`;
          isSelected = selectedItems.includes(itemId);
        } else if (d.depth === 3) {
          itemId = `${d.parent.parent.data.name}-${d.parent.data.name}-${d.data.name}`;
          isSelected = selectedFlavors.includes(itemId);
        }
        
        return isSelected ? 1 : 0.8;
      })
      .on("mouseover", function(event, d: D3HierarchyNode) {
        d3.select(this)
          .style("opacity", 1)
          .style("stroke-width", 3);
      })
      .on("mouseout", function(event, d: D3HierarchyNode) {
        let itemId: string;
        let isSelected = false;
        
        if (d.depth === 1) {
          itemId = `category-${d.data.name}`;
          isSelected = selectedItems.includes(itemId);
        } else if (d.depth === 2) {
          itemId = `subcategory-${d.parent.data.name}-${d.data.name}`;
          isSelected = selectedItems.includes(itemId);
        } else if (d.depth === 3) {
          itemId = `${d.parent.parent.data.name}-${d.parent.data.name}-${d.data.name}`;
          isSelected = selectedFlavors.includes(itemId);
        }
        
        d3.select(this)
          .style("opacity", isSelected ? 1 : 0.8)
          .style("stroke-width", 2);
      })
      .on("click", function(event, d: D3HierarchyNode) {
        toggleItem(d);
        
        d3.select(this)
          .transition()
          .duration(200)
          .style("transform", "scale(1.05)")
          .transition()
          .duration(200)
          .style("transform", "scale(1)");
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
        // 円のサイズに応じてフォントサイズを調整（より小さく）
        const baseSize = Math.max(6, Math.min(16, radius / 20)); // 最小6px、最大16px
        
        if (d.depth === 1) {
          return Math.max(8, Math.min(14, baseSize * 1.2)) + "px";   // カテゴリ
        } else if (d.depth === 2) {
          return Math.max(7, Math.min(12, baseSize * 1.0)) + "px";   // サブカテゴリ
        } else {
          return Math.max(6, Math.min(10, baseSize * 0.9)) + "px";   // フレーバー
        }
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
        const sizeFactor = Math.max(0.5, Math.min(1.5, radius / 200)); // 円のサイズに応じて閾値を調整
        
        if (d.depth === 1 && angleWidth < 0.2 * sizeFactor) return 0;   // カテゴリが狭すぎる場合
        if (d.depth === 2 && angleWidth < 0.08 * sizeFactor) return 0;  // サブカテゴリが狭すぎる場合  
        if (d.depth === 3 && angleWidth < 0.03 * sizeFactor) return 0;  // フレーバーが狭すぎる場合
        return 1;
      })
      .text((d: D3HierarchyNode) => {
        const angleWidth = d.x1 - d.x0;
        const sizeFactor = Math.max(0.5, Math.min(1.5, radius / 200)); // 円のサイズに応じて調整
        let maxLength;
        
        if (d.depth === 1) {
          maxLength = angleWidth > 0.4 ? Math.floor(30 * sizeFactor) : Math.floor(20 * sizeFactor);   // カテゴリ
        } else if (d.depth === 2) {
          maxLength = angleWidth > 0.2 ? Math.floor(25 * sizeFactor) : Math.floor(15 * sizeFactor);   // サブカテゴリ
        } else {
          maxLength = angleWidth > 0.08 ? Math.floor(20 * sizeFactor) : Math.floor(12 * sizeFactor);   // フレーバー
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

    // 中央にタイトル（より小さく）
    const titleSize = Math.max(10, Math.min(14, radius / 25));
    const subtitleSize = Math.max(8, Math.min(12, radius / 30));
    
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .style("font-size", titleSize + "px")
      .style("font-weight", "bold")
      .style("fill", "#374151")
      .text("COFFEE");
    
    g.append("text")
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("dy", "1.2em")
      .style("font-size", subtitleSize + "px")
      .style("fill", "#6b7280")
      .text("FLAVORS");

  }, [flavorData, selectedFlavors, selectedItems]);

  const toggleFlavor = (category: string, subcategory: string, flavor: string) => {
    const flavorId = `${category}-${subcategory}-${flavor}`;
    
    setSelectedFlavors(prev => {
      if (prev.includes(flavorId)) {
        return prev.filter(id => id !== flavorId);
      } else {
        return [...prev, flavorId];
      }
    });
    
    // selectedItemsも更新
    setSelectedItems(prev => {
      if (prev.includes(flavorId)) {
        return prev.filter(id => id !== flavorId);
      } else {
        return [...prev, flavorId];
      }
    });
  };

  const toggleItem = (d: D3HierarchyNode) => {
    let itemId: string;
    
    if (d.depth === 1) {
      // カテゴリ
      itemId = `category-${d.data.name}`;
    } else if (d.depth === 2) {
      // サブカテゴリ
      itemId = `subcategory-${d.parent.data.name}-${d.data.name}`;
    } else {
      // フレーバー（既存の処理）
      toggleFlavor(d.parent.parent.data.name, d.parent.data.name, d.data.name);
      return;
    }
    
    setSelectedItems(prev => {
      if (prev.includes(itemId)) {
        return prev.filter(id => id !== itemId);
      } else {
        return [...prev, itemId];
      }
    });
  };

  const clearSelections = () => {
    setSelectedFlavors([]);
    setSelectedItems([]);
    setParticipantName('');
    setParticipantAge('');
    setCoffeeName('');
    setShowSubmitForm(false);
  };

  const submitSurvey = async () => {
    if (participantName.trim() && participantAge.trim() && coffeeName.trim() && (selectedFlavors.length > 0 || selectedItems.length > 0)) {
      const age = parseInt(participantAge);
      if (isNaN(age) || age < 1 || age > 120) {
        alert('正しい年齢を入力してください（1-120歳）');
        return;
      }

      setIsSubmitting(true);
      try {
        const flavorsData = selectedFlavors.map(id => {
          const [category, subcategory, flavor] = id.split('-');
          return { category, subcategory, flavor };
        });

        const itemsData = selectedItems.map(id => {
          if (id.startsWith('category-')) {
            return { type: 'category', name: id.replace('category-', '') };
          } else if (id.startsWith('subcategory-')) {
            const [, category, subcategory] = id.split('-');
            return { type: 'subcategory', category, name: subcategory };
          }
          return null;
        }).filter(Boolean);

        // サーバーに送信
        const response = await fetch('/api/surveys', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: participantName.trim(),
            age: age,
            coffeeName: coffeeName.trim(),
            flavors: flavorsData,
            items: itemsData
          })
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        const result = await response.json();
        console.log('API Response:', result);

        if (result.success) {
          // ローカル状態を更新
          setSubmissions(prev => [result.data, ...prev]);
          clearSelections();
          alert('アンケートを送信しました！ありがとうございます。');
        } else {
          console.error('API Error:', result.error);
          alert(`送信に失敗しました: ${result.error || '不明なエラー'}`);
        }
      } catch (error) {
        console.error('Submit error:', error);
        console.error('Error details:', {
          name: error instanceof Error ? error.name : 'Unknown',
          message: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : 'No stack trace'
        });
        alert(`送信中にエラーが発生しました: ${error instanceof Error ? error.message : '不明なエラー'}`);
      } finally {
        setIsSubmitting(false);
      }
      }
  };

  const downloadResults = () => {
    const csvContent = [
      'ID,名前,年齢,コーヒー名,タイムスタンプ,選択したフレーバー数,フレーバー詳細',
      ...submissions.map(sub => 
        `${sub.id},"${sub.name}",${sub.age},"${sub.coffeeName || ''}","${sub.timestamp}",${sub.flavors.length},"${sub.flavors.map(f => `${f.category}&gt;${f.subcategory}&gt;${f.flavor}`).join('; ')}"`
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
      <div className="max-w-7xl mx-auto">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-amber-900 mb-2">☕ コーヒーフレーバーホイール</h1>
          <p className="text-amber-700 text-lg">外側のフレーバーをクリックして選択してください</p>
          {(selectedFlavors.length > 0 || selectedItems.length > 0) && (
            <div className="mt-4 p-3 bg-white rounded-lg shadow-md">
              <p className="text-sm text-gray-600 mb-2">選択中: {selectedFlavors.length + selectedItems.length}個のアイテム</p>
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
          <div className="bg-white rounded-xl shadow-2xl p-4 sm:p-8 w-full max-w-6xl overflow-hidden">
            <svg ref={svgRef} className="w-full h-auto max-w-full"></svg>
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
                className="w-full p-3 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-amber-500 text-gray-900 placeholder-gray-500"
              />
              <input
                type="text"
                placeholder="コーヒーの名前を入力してください（例：ブルーマウンテン、キリマンジャロなど）"
                value={coffeeName}
                onChange={(e) => setCoffeeName(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-lg mb-3 focus:outline-none focus:ring-2 focus:ring-amber-500 text-gray-900 placeholder-gray-500"
              />
              <input
                type="number"
                placeholder="年齢を入力してください"
                value={participantAge}
                onChange={(e) => setParticipantAge(e.target.value)}
                min="1"
                max="120"
                className="w-full p-3 border border-gray-300 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-amber-500 text-gray-900 placeholder-gray-500"
              />
              <div className="flex gap-2">
                <button
                  onClick={submitSurvey}
                  disabled={!participantName.trim() || !participantAge.trim() || !coffeeName.trim() || (selectedFlavors.length === 0 && selectedItems.length === 0) || isSubmitting}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      送信中...
                    </>
                  ) : (
                    '送信'
                  )}
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
                    <th className="text-left p-2">コーヒー名</th>
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
                      <td className="p-2 font-medium text-amber-700">{submission.coffeeName || '未入力'}</td>
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
