"use client";

import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { useAuthSession } from "@/src/modules/identity";
import type { AppDispatch } from "./store/store";
import { userAction } from "./store/slice";

const AutoLogin = () => {
    const dispatch = useDispatch<AppDispatch>();
    const { restore } = useAuthSession();

    useEffect(() => {
        let isActive = true;

        void restore().then((result) => {
            if (!isActive || !result.ok || !result.value.profile) return;
            const profile = result.value.profile;
            dispatch(userAction.setInfo({
                username: profile.nickname,
                role: profile.role,
                uuid: profile.id,
            }));
        });

        return () => {
            isActive = false;
        };
    }, [dispatch, restore]);

    return null;
};

export default AutoLogin;
