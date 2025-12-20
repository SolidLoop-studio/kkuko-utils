/**
 * 텍스트 파일에서 단어를 파싱합니다.
 * @param file - 업로드된 텍스트 파일
 * @returns 파싱된 단어 배열
 */
export async function parseWordsFromFile(file: File): Promise<string[]> {
    if (file.size > 1024 * 1024) {
        throw new Error('파일 크기는 1MB를 초과할 수 없습니다.');
    }

    if (!file.name.endsWith('.txt')) {
        throw new Error('txt 파일만 업로드 가능합니다.');
    }

    const pattern = /[^a-zA-Z0-9가-힣ㄱ-ㅎ]/g;
    const text = await file.text();
    
    // 줄바꿈으로 분리하고 특수문자 제거 및 소문자 변환
    return text
        .split('\n')
        .map(line => line.replace(pattern, '').toLowerCase())
        .filter(line => line.length > 1);
}