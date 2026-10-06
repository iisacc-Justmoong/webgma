<a id="publishing-checklist"></a>

# 출판 체크리스트

<a id="what-this-project-prepares"></a>

## 이 프로젝트가 준비하는 것

- 로컬 개발 가져오기용 루트 [manifest.json](/Volumes/Storage/Workspace/Product/Webgma/manifest.json)
- `npm run prepare:release` - `build/release/` 생성
- 배포를 위한 상대 자산 경로가 있는 `build/release/` 내부의 릴리스 준비 `manifest.json`

<a id="pre-publish-checklist"></a>

## 사전 게시 체크리스트

1. Figma 데스크톱 앱을 사용하세요.
2. 게시 계정에서 2단계 인증을 활성화합니다.
3. `npm run prepare:release`를 실행합니다.
4. 패키지된 양식을 확인하려면 Figma에서 `build/release/manifest.json`에서 릴리스 매니페스트를 가져옵니다.
5. 매니페스트가 여전히 제품 동작과 일치하는지 확인합니다.
   - `editorType`는 `figma`입니다.
   - `documentAccess`는 `dynamic-page`입니다.
   - `networkAccess`는 무제한 이미지 가져오기가 필요한 이유를 설명합니다.
6. 커뮤니티 목록 자산 준비:
   - 아이콘: 128 x 128px 권장
   - 썸네일: 1920 x 1080px 권장
   - 지원 연락처
   - 이름, 태그라인, 설명, 카테고리
7. Figma 데스크톱 앱의 `Plugins > Manage plugins`에서 게시하세요.

<a id="notes"></a>

## 메모

- 플러그인 `id`는 의도적으로 여기에 하드 코딩되지 않았습니다. Figma는 플러그인 초안을 생성하거나 게시할 때 이를 할당합니다.
- 이미지 가져오기 요구 사항이 좁아지면 제출하기 전에 `allowedDomains: ["*"]`를 제한된 목록으로 바꾸세요.

<a id="official-references"></a>

## 공식 참고자료

- [플러그인 매니페스트 문서](https://developers.figma.com/docs/plugins/manifest/)
- [문서 게시](https://developers.figma.com/docs/plugins/publishing/)
- [커뮤니티 게시 가이드](https://help.figma.com/hc/en-us/articles/360042293394-Publish-plugins-to-the-Figma-Community)
