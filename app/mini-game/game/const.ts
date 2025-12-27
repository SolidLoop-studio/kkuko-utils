export const KOREAN_CHARS = ['가', '나', '다', '라', '마', '바', '사', '아', '자', '차', '카', '타', '파', '하'];
export const ENGLISH_CHARS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];

export const BEAT = [
    null,
    "10000000",
    "10001000",
    "10010010",
    "10011010",
    "11011010",
    "11011110",
    "11011111",
    "11111111"
];

export const koreanRegex = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/;
export const englishRegex = /[a-zA-Z]/;