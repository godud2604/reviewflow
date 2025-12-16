"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import { X, MapPin, Search, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { ScrollArea } from "@/components/ui/scroll-area"

declare global {
  interface Window {
    kakao: any;
  }
}

export type MapPlaceSelection = {
  region: string;
  address: string;
  phone: string;
  latitude: number;
  longitude: number;
}

export default function KakaoMapSearchModal({
  isOpen,
  onClose,
  onSelectPlace,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectPlace: (place: MapPlaceSelection) => void;
}) {
  const { toast } = useToast();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerInstance = useRef<any>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);
  const listViewportRef = useRef<HTMLDivElement | null>(null);
  
  const [searchKeyword, setSearchKeyword] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState<MapPlaceSelection | null>(null);

  // 3. 장소 클릭 시 지도 이동 및 마커 찍기 (순서상 위로 올림)
  const handlePlaceSelect = useCallback((place: MapPlaceSelection) => {
    if (!mapInstance.current || !window.kakao) return;

    const moveLatLon = new window.kakao.maps.LatLng(place.latitude, place.longitude);
    
    // 마커 업데이트 로직
    if (markerInstance.current) {
      markerInstance.current.setMap(null);
    }

    markerInstance.current = new window.kakao.maps.Marker({
      position: moveLatLon,
    });
    
    markerInstance.current.setMap(mapInstance.current);
    mapInstance.current.setCenter(moveLatLon);
    mapInstance.current.setLevel(3);

    setSelectedPlace(place);
  }, []);

  // 1. 지도 초기화 함수
  const initMap = useCallback(() => {
    if (!window.kakao || !mapRef.current) return;

    window.kakao.maps.load(() => {
      if (!mapRef.current) return;
      
      const options = {
        center: new window.kakao.maps.LatLng(37.5665, 126.9780),
        level: 3,
      };

      mapInstance.current = new window.kakao.maps.Map(mapRef.current, options);
    });
  }, []);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        initMap();
      }, 300);
      return () => clearTimeout(timer);
    }

    mapInstance.current = null;
    markerInstance.current = null;
    setSearchResults([]);
    setSelectedPlace(null);
    setSearchKeyword("");
  }, [isOpen, initMap]);

  useEffect(() => {
    if (listContainerRef.current) {
      listViewportRef.current = listContainerRef.current.querySelector('[data-slot="scroll-area-viewport"]') as HTMLDivElement | null;
    }

    const viewport = listViewportRef.current;
    if (!viewport || searchResults.length < 3) return;

    viewport.scrollTop = 0;
    const peekTimeout = setTimeout(() => {
      viewport.scrollTo({ top: 12, behavior: "smooth" });
    }, 80);

    const resetTimeout = setTimeout(() => {
      viewport.scrollTo({ top: 0, behavior: "smooth" });
    }, 500);

    return () => {
      clearTimeout(peekTimeout);
      clearTimeout(resetTimeout);
    };
  }, [searchResults.length]);

  // 2. 장소 검색 (카카오 로컬 API 활용)
  const fetchPlaces = useCallback(async (query: string) => {
    if (!query.trim()) return;
    setIsLoading(true);

    try {
      const response = await fetch(`/api/kakao-search?query=${encodeURIComponent(query)}`);
      const data = await response.json();

      if (!data.documents || data.documents.length === 0) {
        toast({ title: "검색 결과가 없습니다." });
        setSearchResults([]);
        return;
      }

      const results = data.documents.map((item: any) => ({
        region: item.place_name,
        address: item.road_address_name || item.address_name,
        phone: item.phone,
        latitude: parseFloat(item.y),
        longitude: parseFloat(item.x),
      }));

      setSearchResults(results);
      
      // 데이터 로드 후 지도가 준비되었다면 첫 번째 장소 자동 선택
      if (mapInstance.current) {
        handlePlaceSelect(results[0]);
      }
    } catch (error) {
      toast({ title: "검색 중 오류 발생", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [toast, handlePlaceSelect]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white overflow-hidden shadow-2xl">
      <div className="px-1 py-4 border-b flex justify-between items-center bg-white shrink-0">
        <span className="pl-4 font-bold text-lg text-neutral-800">장소 검색</span>
        <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-full transition-colors">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="p-4 border-b bg-white flex gap-2 shrink-0">
          <input
            type="text"
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && fetchPlaces(searchKeyword)}
            placeholder="장소명을 입력하세요 (예: 강남역 서브웨이)"
            className="flex-1 min-w-0 h-11 px-3 py-1 bg-[#F7F7F8] border-none rounded-lg text-[16px]"
          />
          <button
            onClick={() => fetchPlaces(searchKeyword)}
            className="flex-shrink-0 w-[56px] h-11 bg-[#FF5722] text-white rounded-lg text-[15px] font-semibold cursor-pointer disabled:opacity-50"
          >
            검색
          </button>
      </div>

      <div className="flex-1 flex flex-col md:flex-row min-h-0">
        {/* 리스트 영역 */}
        <div
          ref={listContainerRef}
          className={`relative ${
            searchResults.length > 0 ? "h-2/5 md:h-full" : "md:h-full"
          } md:w-1/3 border-r bg-white flex flex-col min-h-0 shadow-lg shadow-black/5`}
        >
          <div className="absolute top-2 left-1/2 -translate-x-1/2 h-1.5 w-14 rounded-full bg-neutral-200/80" />
          {/* 스크롤 UI 표시용 shadow */}
          <div className="pointer-events-none absolute top-0 left-0 right-0 h-4 z-10 bg-gradient-to-b from-white/90 to-transparent" />
          <ScrollArea className="flex-1 min-h-0">
            {searchResults.length === 0 && !isLoading && (
              <div className="flex flex-1 items-center justify-center p-10 text-center text-neutral-400 text-sm">
                검색 결과가 여기에 표시됩니다.
              </div>
            )}
            {searchResults.map((place, i) => (
              <div 
                key={i} 
                onClick={() => handlePlaceSelect(place)}
                className={`p-5 border-b cursor-pointer transition-colors ${
                  selectedPlace?.latitude === place.latitude ? 'bg-orange-50 border-orange-200' : 'hover:bg-neutral-50'
                }`}
              >
                <div className="font-bold text-sm text-neutral-900">{place.region}</div>
                <div className="text-xs text-neutral-500 mt-1.5 leading-relaxed">{place.address}</div>
                {place.phone && <div className="text-[10px] text-neutral-400 mt-1">📞 {place.phone}</div>}
              </div>
            ))}
          </ScrollArea>
          {searchResults.length > 2 && (
            <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 rounded-full bg-white/95 px-3 py-1 text-[11px] font-medium text-neutral-500 shadow-sm animate-pulse">
              <svg className="w-3 h-3 text-orange-400" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 16l-6-6h12l-6 6z" fill="currentColor" />
              </svg>
              <span className="text-orange-900">스크롤하여 더보기</span>
            </div>
          )}
          {/* 스크롤 UI 표시용 shadow */}
          <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-4 z-10 bg-gradient-to-t from-white/90 to-transparent" />
        </div>

        {/* 지도 영역 */}
        <div className="flex-1 relative bg-neutral-50 min-h-0">
          {/* 지도가 그려질 Ref 요소 - h-full 필수 */}
          <div ref={mapRef} className="w-full h-full" style={{ position: 'absolute', inset: 0 }} />
          
          {/* 선택된 장소 레이어 */}
          {selectedPlace && (
            <div className="absolute bottom-6 left-6 right-6 bg-white/95 backdrop-blur-md p-5 rounded-2xl shadow-2xl z-10 border border-white flex justify-between items-center animate-in fade-in slide-in-from-bottom-2">
              <div className="flex-1 min-w-0">
                <div className="font-bold text-base text-neutral-900 truncate">{selectedPlace.region}</div>
                <div className="text-xs text-neutral-600 mt-1 truncate">{selectedPlace.address}</div>
              </div>
              <MapPin className="text-orange-500 ml-4 shrink-0 w-6 h-6" />
            </div>
          )}
        </div>
      </div>

      <div className="p-6 border-t bg-white shrink-0">
        <button
          onClick={() => selectedPlace && onSelectPlace(selectedPlace)}
          disabled={!selectedPlace}
        className="w-full h-14 bg-[#FF5722] text-white font-bold text-base rounded-2xl disabled:bg-neutral-100 disabled:text-neutral-400 hover:bg-orange-500 transition-all active:scale-[0.98] shadow-lg"
        >
          {selectedPlace ? `${selectedPlace.region} 선택 완료` : "장소를 선택해주세요"}
        </button>
      </div>
    </div>
  )
}
