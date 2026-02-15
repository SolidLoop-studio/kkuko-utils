import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/src/app/components/ui/card";
import { Shield, Calendar, Lock, Eye } from "lucide-react";

export async function generateMetadata() {
	return {
		title: "끄코 유틸리티 - 개인정보 처리방침",
		description: '끄코 유틸리티 - 개인정보 처리방침',
	};
}

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-8">
          <div className="mx-auto w-12 h-12 bg-gradient-to-br from-green-500 to-blue-600 rounded-full flex items-center justify-center mb-4">
            <Shield className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent mb-2">
            개인정보처리방침
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Kkuko Utils에서 수집하고 처리하는 개인정보에 관한 방침입니다.
          </p>
        </div>

        <Card className="shadow-xl border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-2">
              <Calendar className="h-4 w-4" />
              <span>최종 수정일: 2025년 8월 27일</span>
            </div>
            <CardTitle className="text-xl text-slate-800 dark:text-slate-200">
              제1조 (개인정보의 처리목적)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                SolidLoop-studio(이하 &quot;서비스 제공자&quot;)는 다음의 목적을 위하여 개인정보를 처리합니다. 
                처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 
                이용 목적이 변경되는 경우에는 개인정보보호법 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                <Lock className="h-5 w-5" />
                제2조 (처리하는 개인정보의 항목)
              </h3>
              <div className="space-y-3">
                <div>
                  <h4 className="font-medium text-slate-800 dark:text-slate-200 mb-2">1. 회원가입 및 서비스 이용</h4>
                  <ul className="space-y-1 text-slate-700 dark:text-slate-300 ml-4">
                    <li>• Google 계정 정보 (이메일, 프로필 이미지)</li>
                    <li>• 닉네임 (사용자가 직접 설정)</li>
                    <li>• 서비스 이용 기록</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium text-slate-800 dark:text-slate-200 mb-2">2. 서비스 제공 과정에서 수집되는 정보</h4>
                  <ul className="space-y-1 text-slate-700 dark:text-slate-300 ml-4">
                    <li>• 오픈DB에서 사용자가 생성한 단어 및 배포된 프로그램 데이터</li>
                    <li>• 서비스 이용 로그</li>
                    <li>• 접속 시간, 접속 위치</li>
                  </ul>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
                제3조 (개인정보의 처리 및 보유기간)
              </h3>
              <div className="space-y-3 text-slate-700 dark:text-slate-300">
                <p>
                  1. 서비스 제공자는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 
                  동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.
                </p>
                <p>
                  2. 각각의 개인정보 처리 및 보유 기간은 다음과 같습니다:
                </p>
                <ul className="ml-4 space-y-1">
                  <li>• 회원정보: 회원 탈퇴 시까지</li>
                  <li>• 서비스 이용 기록: 1년</li>
                  <li>• 사용자 생성 데이터: 회원 탈퇴 또는 삭제 요청 시까지</li>
                </ul>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
                제4조 (개인정보의 제3자 제공)
              </h3>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                서비스 제공자는 원칙적으로 정보주체의 개인정보를 수집·이용 목적으로 명시한 범위 내에서 처리하며, 
                정보주체의 사전 동의 없이는 본래의 목적 범위를 초과하여 처리하거나 제3자에게 제공하지 않습니다. 
                다만, 법령에 의한 경우는 예외로 합니다.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
                제5조 (개인정보처리의 위탁)
              </h3>
              <div className="space-y-3 text-slate-700 dark:text-slate-300">
                <p>서비스 제공자는 원활한 개인정보 업무처리를 위하여 다음과 같이 개인정보 처리업무를 위탁하고 있습니다:</p>
                <ul className="ml-4 space-y-1">
                  <li>• Google (OAuth 인증 서비스)</li>
                  <li>• Supabase (데이터베이스 및 인증 서비스)</li>
                  <li>• Vercel (호스팅 서비스)</li>
                </ul>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                <Eye className="h-5 w-5" />
                제6조 (정보주체의 권리·의무 및 행사방법)
              </h3>
              <div className="space-y-3 text-slate-700 dark:text-slate-300">
                <p>정보주체는 서비스 제공자에 대해 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다:</p>
                <ul className="ml-4 space-y-1">
                  <li>• 개인정보 처리현황 통지 요구</li>
                  <li>• 개인정보 열람 요구</li>
                  <li>• 개인정보 정정·삭제 요구</li>
                  <li>• 개인정보 처리정지 요구</li>
                </ul>
                <p>
                  권리 행사는 GitHub 이슈또는 이메일(jtw7913@gmail.com) 통해 요청하실 수 있으며, 서비스 제공자는 지체 없이 조치하겠습니다.
                </p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
                제7조 (개인정보의 파기)
              </h3>
              <div className="space-y-3 text-slate-700 dark:text-slate-300">
                <p>
                  1. 서비스 제공자는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 
                  지체없이 해당 개인정보를 파기합니다.
                </p>
                <p>
                  2. 개인정보 파기의 절차 및 방법은 다음과 같습니다:
                </p>
                <ul className="ml-4 space-y-1">
                  <li>• 파기절차: 선정된 개인정보는 개인정보 보호책임자의 승인을 받아 파기됩니다.</li>
                  <li>• 파기방법: 전자적 파일 형태로 기록·저장된 개인정보는 기록을 재생할 수 없도록 로우레벨포맷 등의 방법을 이용하여 파기합니다.</li>
                </ul>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
                제8조 (개인정보의 안전성 확보조치)
              </h3>
              <div className="space-y-3 text-slate-700 dark:text-slate-300">
                <p>서비스 제공자는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다:</p>
                <ul className="ml-4 space-y-1">
                  <li>• 개인정보에 대한 접근 제한</li>
                  <li>• 암호화 기술을 이용한 개인정보 보호</li>
                  <li>• 해킹 등에 대비한 기술적 대책</li>
                  <li>• 개인정보처리시스템 등의 접근권한 관리</li>
                </ul>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
                제9조 (개인정보 보호책임자)
              </h3>
              <div className="space-y-3 text-slate-700 dark:text-slate-300">
                <p>서비스 제공자는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제를 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다:</p>
                <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-lg">
                  <p><strong>개인정보 보호책임자</strong></p>
                  <p>개발자: hafskjfha</p>
                  <p>연락처: admin@solidloop-studio.xyz</p>
                </div>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
                제10조 (개인정보처리방침의 변경)
              </h3>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                이 개인정보처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및 정정이 있는 경우에는 
                변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
                제11조 (개인정보의 국외 이전)
              </h3>
              <ul className="ml-4 space-y-1 text-slate-700 dark:text-slate-300">
                <li>이전받는 자: Google LLC</li>
                <li>• 이전되는 개인정보 항목: Google 계정 정보 (이메일, 프로필 이미지)</li>
                <li>• 이전받는 자의 개인정보 이용목적: OAuth 인증 서비스 제공</li>
                <li>• 이전받는 자의 보유·이용기간: Google 개인정보처리방침에 따름</li>
                <li>• 이전받는 국가 및 이전일시: 미국, 서비스 이용 시</li>
              </ul>
              <br/>
              <ul className='ml-4 space-y-1 text-slate-700 dark:text-slate-300'>
                <li>이전받는 자: Supabase Inc.</li>
                <li>• 이전되는 개인정보 항목: 회원정보, 서비스 이용 데이터</li>
                <li>• 이전받는 자의 개인정보 이용목적: OAuth 인증 서비스 제공</li>
                <li>• 이전받는 자의 보유·이용기간: 회원 탈퇴 시까지</li>
                <li>• 이전받는 국가 및 이전일시: 미국, 서비스 이용 시</li>
              </ul>
              <br/>
              <ul className='ml-4 space-y-1 text-slate-700 dark:text-slate-300'>
                <li>이전받는 자: Vercel Inc.</li>
                <li>• 이전되는 개인정보 항목: 접속 로그, IP 주소</li>
                <li>• 이전받는 자의 개인정보 이용목적: 웹사이트 호스팅 서비스 제공</li>
                <li>• 이전받는 자의 보유·이용기간: 서비스 제공 기간</li>
                <li>• 이전받는 국가 및 이전일시: 미국, 서비스 이용 시</li>
              </ul>
            </div>

            <div className="border-t pt-6 mt-8">
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Shield className="h-4 w-4" />
                <span>개인정보 관련 문의사항이 있으시면 GitHub 이슈또는 이메일(admin@solidloop-studio.xyz) 통해 연락주시기 바랍니다.</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
