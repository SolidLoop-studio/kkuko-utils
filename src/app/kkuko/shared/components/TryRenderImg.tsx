"use client";

import React, { useEffect, useState } from "react";
import Image from "next/image";

type Props = {
	placeholder?: React.ReactNode;
	url: string;
	alt?: string;
	width?: number;
	height?: number;
	className?: string;
	maxRetries?: number;
	hanldeLoad?: (event: React.SyntheticEvent<HTMLImageElement, Event>) => void;
	onFailure?: () => void;
};

export default function TryRenderImg({
	placeholder = null,
	url,
	alt = "",
	width,
	height,
	className,
	hanldeLoad,
	onFailure,
	maxRetries = 3,
}: Props) {
	const [attempt, setAttempt] = useState(0);
	const [failed, setFailed] = useState(false);
	const isCdn = true; // url.startsWith('https://cdn.kkutu.co.kr/img/');
	const [src, setSrc] = useState(`${isCdn ? 'https://img-proxy.jtw7913.workers.dev?v=3&url=' : ''}${url}`);
	
	useEffect(() => {
		setSrc(`${isCdn ? 'https://img-proxy.jtw7913.workers.dev?v=3&url=' : ''}${url}`);
		setAttempt(0);
		setFailed(false);
	}, [url]);

	const handleError = () => {
		if (attempt < maxRetries) {
			const next = attempt + 1;
			setAttempt(next);
			const separator = (url.includes("?") || isCdn) ? "&" : "?";
			setSrc(`${isCdn ? 'https://img-proxy.jtw7913.workers.dev?v=3&url=' : ''}${url}${separator}r=${next}&ts=${Date.now()}`);
		} else {
			setFailed(true);
			onFailure?.();
		}
	};

	const onLoad = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
		if (failed) setFailed(false);
		hanldeLoad?.(e);
	};

	if (failed) return <>{placeholder ?? null}</>;

	return (
		<>
			{width && height ? (
				<Image
					src={src}
					alt={alt}
					width={width}
					height={height}
					className={className}
					onError={handleError}
					onLoad={onLoad}
					unoptimized={isCdn}
					crossOrigin={isCdn ? "anonymous" : undefined}
				/>
			) : (
				<div style={{ position: "relative" }} className={className}>
					<Image
						src={src}
						alt={alt}
						fill
						sizes="100vw"
						style={{ objectFit: "cover" }}
						onError={handleError}
						onLoad={onLoad}
						unoptimized={isCdn}
						crossOrigin={isCdn ? "anonymous" : undefined}
					/>
				</div>
			)}
		</>
	);
}

