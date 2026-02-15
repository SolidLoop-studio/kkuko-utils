import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/src/app/components/ui/card";
import { FileText, Calendar, Shield } from "lucide-react";

export async function generateMetadata() {
	return {
		title: "끄코 유틸리티 - 운영 약관",
		description: '끄코 유틸리티 - 운영 약관',
	};
}

const TermsOfService = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="text-center mb-8">
          <div className="mx-auto w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-4">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-900 to-slate-600 dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent mb-2">
            서비스 이용약관
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Kkuko Utils 서비스 이용에 관한 약관입니다.
          </p>
        </div>

        <Card className="shadow-xl border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 mb-2">
              <Calendar className="h-4 w-4" />
              <span>최종 수정일: 2025년 12월 20일</span>
            </div>
            <CardTitle className="text-xl text-slate-800 dark:text-slate-200">
              제1조 (목적)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                본 약관은 SolidLoop-studio(이하 &quot;서비스 제공자&quot;)가 제공하는 Kkuko Utils 서비스(이하 &quot;서비스&quot;)의 이용과 관련하여
                서비스 제공자와 이용자 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
                제2조 (정의)
              </h3>
              <ul className="space-y-2 text-slate-700 dark:text-slate-300">
                <li>• &quot;서비스&quot;란 서비스 제공자가 제공하는 Kkuko Utils 웹 서비스를 의미합니다.</li>
                <li>• &quot;이용자&quot;란 본 약관에 따라 서비스를 이용하는 회원 및 비회원을 의미합니다.</li>
                <li>• &quot;회원&quot;란 서비스에 개인정보를 제공하여 회원등록을 한 자를 의미합니다.</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
                제3조 (약관의 효력과 변경)
              </h3>
              <div className="text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
                <p>1. 본 약관은 서비스 화면에 게시하거나 기타의 방법으로 회원에게 공지함으로써 효력을 발생합니다.</p>
                <p>2. 서비스 제공자는 필요하다고 인정되는 경우 본 약관을 변경할 수 있으며, 변경된 약관은 변경 사유와 함께 변경일로부터 최소 7일 전에 서비스 내 공지사항을 통해 공지합니다.</p>
                <p>3. 이용자가 변경된 약관의 적용에 동의하지 않는 경우 서비스 이용을 중단하고 탈퇴할 수 있습니다. 변경된 약관의 시행일 이후 서비스를 계속 이용하는 경우에는 약관의 변경에 동의한 것으로 간주됩니다.</p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
                제4조 (회원가입)
              </h3>
              <div className="text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
                <p>1. 회원가입은 Google 계정을 통해 진행됩니다.</p>
                <p>2. 회원가입 시 닉네임을 설정해야 하며, 다른 회원과 중복되지 않아야 합니다.</p>
                <p>3. 회원가입 신청자가 본 약관 및 개인정보처리방침에 동의하고 회원가입을 완료하면 서비스 제공자는 회원자격을 부여합니다.</p>
                <p>4. 서비스 제공자는 다음의 경우 회원가입을 거절하거나 사후에 회원자격을 박탈할 수 있습니다:</p>
                <ul className="ml-4 space-y-1">
                  <li>• 본 약관을 위반한 경우</li>
                  <li>• 타인의 명의나 정보를 도용한 경우</li>
                  <li>• 부적절한 닉네임을 사용한 경우</li>
                  <li>• 기타 서비스 제공자가 정한 가입 요건을 충족하지 않는 경우</li>
                </ul>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
                제5조 (서비스의 제공)
              </h3>
              <div className="text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
                <p>1. 서비스 제공자는 회원에게 다음과 같은 서비스를 제공합니다:</p>
                <ul className="ml-4 space-y-1">
                  <li>• 단어장 관리 도구</li>
                  <li>• 오픈 DB 사용</li>
                  <li>• 단어 조합 도구</li>
                  <li>• 기타 유틸리티 서비스</li>
                </ul>
                <p>2. 서비스는 연중무휴, 1일 24시간 제공됨을 원칙으로 하나, 서버의 정기점검 등의 필요에 의해 일시 중단될 수 있습니다.</p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
                제6조 (이용자의 의무)
              </h3>
              <div className="text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
                <p>1. 이용자는 다음 행위를 하여서는 안 됩니다:</p>
                <ul className="ml-4 space-y-1">
                  <li>• 타인의 정보 도용</li>
                  <li>• 서비스의 운영을 방해하는 행위</li>
                  <li>• 타인에게 피해를 주는 행위</li>
                  <li>• 본 웹게임(끄투코리아)의 운영정책을 위반하는 행위</li>
                  <li>• 법령에 위반되는 행위</li>
                  <li>• 부적절한 콘텐츠(욕설, 비방, 음란물 등) 등록</li>
                  <li>• 상업적 목적으로 서비스를 무단 이용하는 행위</li>
                  <li>• 서비스의 소스코드를 무단으로 복제하거나 배포하는 행위</li>
                </ul>
                <p>2. 이용자는 서비스 이용과 관련하여 관련 법령을 준수해야 합니다.</p>
                <p>3. 위 의무를 위반한 이용자에 대해서는 서비스 이용 제한, 회원자격 박탈 등의 조치를 취할 수 있습니다.</p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
                제7조 (개인정보보호)
              </h3>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                서비스 제공자는 이용자의 개인정보를 보호하기 위해 개인정보처리방침을 수립하고 이를 준수합니다.
                개인정보 처리에 관한 자세한 사항은 별도의 개인정보처리방침에서 정합니다.
              </p>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
                제8조 (콘텐츠 및 지적재산권)
              </h3>
              <div className="text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
                <p>1. 서비스에 대한 저작권 및 지적재산권은 서비스 제공자에게 귀속됩니다.</p>
                <p>2. 이용자가 서비스 내에 게시한 콘텐츠(단어, 데이터 등)에 대한 권리는 해당 이용자에게 있습니다.</p>
                <p>3. 이용자는 자신이 게시한 콘텐츠에 대해 다른 이용자들이 서비스 내에서 이용할 수 있도록 동의합니다.</p>
                <p>4. 이용자는 타인의 저작권, 상표권 등 지적재산권을 침해하는 콘텐츠를 게시해서는 안 됩니다.</p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
                제9조 (서비스 중단 및 계정 해지)
              </h3>
              <div className="text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
                <p>1. 서비스 제공자는 다음의 경우 서비스 제공을 중단하거나 이용자의 이용을 제한할 수 있습니다:</p>
                <ul className="ml-4 space-y-1">
                  <li>• 이용자가 본 약관을 위반한 경우</li>
                  <li>• 서비스 운영상 필요한 경우</li>
                  <li>• 기타 서비스 제공자가 필요하다고 판단하는 경우</li>
                </ul>
                <p>2. 이용자는 언제든지 회원탈퇴를 통해 서비스 이용을 종료할 수 있습니다.</p>
                <p>3. 회원탈퇴 시 이용자의 개인정보는 개인정보처리방침에 따라 처리됩니다.</p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
                제10조 (면책조항)
              </h3>
              <div className="text-slate-700 dark:text-slate-300 leading-relaxed space-y-2">
                <p>1. 서비스 제공자는 천재지변, 전쟁, 기타 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는 책임이 면제됩니다.</p>
                <p>2. 서비스 제공자는 이용자의 귀책사유로 인한 서비스 이용의 장애에 대하여는 책임을 지지 않습니다.</p>
                <p>3. 서비스 제공자는 이용자가 서비스를 통해 얻은 정보나 자료 등에 대해서는 신뢰성, 정확성 등을 보장하지 않으며, 이로 인한 손해에 대해 책임을 지지 않습니다.</p>
                <p>4. 본 서비스는 무료로 제공되는 서비스로, 서비스 제공자는 법령에서 정하는 경우를 제외하고는 손해배상 책임을 지지 않습니다.</p>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200 mb-3">
                제11조 (준거법 및 관할법원)
              </h3>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                본 약관의 해석 및 서비스 제공자와 이용자 간의 분쟁에 대하여는 대한민국의 법을 적용하며, 
                대한민국 법원을 관할법원으로 합니다.
              </p>
            </div>

            <div className="border-t pt-6 mt-8">
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Shield className="h-4 w-4" />
                <span>문의사항이 있으시면 GitHub 이슈 또는 이메일(admin@solidloop-studio.xyz)을 통해 연락주시기 바랍니다.</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TermsOfService;